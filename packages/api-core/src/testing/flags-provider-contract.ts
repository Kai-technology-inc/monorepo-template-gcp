import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineFlag, type FlagKey, type FlagRule } from '@app/contracts';
import type {
    FlagContext,
    FlagRegistry,
    FlagsProvider,
    FlagsProviderOptions,
} from '../flags/flags-provider';

/**
 * THE CONTRACT EVERY FLAGS ADAPTER PASSES
 *
 * A new adapter (`packages/api-core/src/flags/<name>/`) is ready when its spec calls
 * `describeFlagsProviderContract('<name>', harness)` and every case below passes. The harness expresses the same
 * rules the way that adapter's backend does (a Firestore document, a LaunchDarkly flag, a Remote Config template),
 * so the spec of each adapter also documents how its console maps to "off / everyone / percentage / allow-list".
 *
 * The contract brings its own flags, one of each kind, so it does not depend on the ones your product declares.
 */
export const CONTRACT_FLAGS = {
    'contract-boolean': defineFlag.boolean({
        defaultValue: false,
        description: 'Shared spec: a boolean flag.',
        addedOn: '2026-11-24',
    }),
    'contract-string': defineFlag.string(
        {
            defaultValue: 'control',
            description: 'Shared spec: a string flag with a closed set of values.',
            addedOn: '2026-11-24',
        },
        z.enum(['control', 'treatment']),
    ),
    'contract-number': defineFlag.number(
        {
            defaultValue: 10,
            description: 'Shared spec: a bounded number flag.',
            addedOn: '2026-11-24',
        },
        z.number().int().min(1).max(100),
    ),
    'contract-json': defineFlag.json(
        z.object({ tone: z.enum(['info', 'warning']), dismissible: z.boolean() }),
        {
            defaultValue: { tone: 'info', dismissible: true },
            description: 'Shared spec: a JSON flag with its own schema.',
            addedOn: '2026-11-24',
        },
    ),
} satisfies FlagRegistry;

export type ContractFlagKey = keyof typeof CONTRACT_FLAGS;
export type ContractRules = Readonly<Partial<Record<ContractFlagKey, FlagRule>>>;

export interface FlagsProviderHarness {
    /** A provider built with `options` whose backend serves `rules`, expressed the way that backend does. */
    withRules(rules: ContractRules, options: FlagsProviderOptions): Promise<FlagsProvider>;
    /** A provider whose backend fails: it throws, or never answers. */
    broken(options: FlagsProviderOptions): Promise<FlagsProvider>;
    /** Releases what the harness opened (clients, apps). */
    close?(): Promise<void>;
}

/** A rule serving `value`, nobody targeted unless `overrides` say so. */
export function contractRule(value: unknown, overrides: Partial<FlagRule> = {}): FlagRule {
    return {
        enabled: true,
        value: value as FlagRule['value'],
        percent: 0,
        bucketBy: 'user',
        allowList: { userIds: [], workspaceIds: [] },
        ...overrides,
    };
}

const PEOPLE = Array.from({ length: 2000 }, (_, index): FlagContext => ({
    userId: `user-${index}`,
    workspaceId: `workspace-${index % 40}`,
}));

export function describeFlagsProviderContract(name: string, harness: FlagsProviderHarness): void {
    describe(`${name} adapter: the feature-flags contract`, () => {
        const logged: string[] = [];
        const options: FlagsProviderOptions = {
            flags: CONTRACT_FLAGS,
            timeoutMs: 250,
            logger: {
                warn: (message: unknown) => logged.push(String(message)),
                error: (message: unknown) => logged.push(String(message)),
            },
        };
        const evaluate = (provider: FlagsProvider, key: ContractFlagKey, context: FlagContext) =>
            provider.evaluate(key as FlagKey, context) as Promise<unknown>;
        const withRule = (key: ContractFlagKey, rule: FlagRule) =>
            harness.withRules({ [key]: rule }, options);
        const holders = async (provider: FlagsProvider): Promise<Set<string>> => {
            const values = await Promise.all(
                PEOPLE.map((person) => evaluate(provider, 'contract-boolean', person)),
            );
            return new Set(PEOPLE.filter((_, i) => values[i] === true).map((p) => p.userId));
        };

        afterAll(async () => {
            await harness.close?.();
        });

        it('serves the declared default when nothing targets a flag', async () => {
            const provider = await harness.withRules({}, options);
            expect(await provider.evaluateAll({ userId: 'ada', workspaceId: 'acme' })).toEqual(
                Object.fromEntries(
                    Object.entries(CONTRACT_FLAGS).map(([key, flag]) => [key, flag.defaultValue]),
                ),
            );
        });

        it('serves every kind of value, parsed with its schema', async () => {
            const provider = await harness.withRules(
                {
                    'contract-boolean': contractRule(true, { percent: 100 }),
                    'contract-string': contractRule('treatment', { percent: 100 }),
                    'contract-number': contractRule(42, { percent: 100 }),
                    'contract-json': contractRule(
                        { tone: 'warning', dismissible: false },
                        { percent: 100 },
                    ),
                },
                options,
            );
            expect(await provider.evaluateAll({ userId: 'ada', workspaceId: 'acme' })).toEqual({
                'contract-boolean': true,
                'contract-string': 'treatment',
                'contract-number': 42,
                'contract-json': { tone: 'warning', dismissible: false },
            });
        });

        it('gives the same context the same variation, every time', async () => {
            const provider = await withRule(
                'contract-boolean',
                contractRule(true, { percent: 50 }),
            );
            const sample = PEOPLE.slice(0, 200);
            const first = await Promise.all(
                sample.map((person) => evaluate(provider, 'contract-boolean', person)),
            );
            for (let round = 0; round < 3; round += 1) {
                const again = await Promise.all(
                    sample.map((person) => evaluate(provider, 'contract-boolean', person)),
                );
                expect(again).toEqual(first);
            }
            expect(new Set(first)).toEqual(new Set([true, false]));
        });

        it('splits a percentage rollout roughly as configured', async () => {
            const provider = await withRule(
                'contract-boolean',
                contractRule(true, { percent: 25 }),
            );
            const share = (await holders(provider)).size / PEOPLE.length;
            expect(share).toBeGreaterThan(0.21);
            expect(share).toBeLessThan(0.29);
        });

        it('keeps everyone who had the variation when the percentage grows', async () => {
            const at10 = await holders(
                await withRule('contract-boolean', contractRule(true, { percent: 10 })),
            );
            const at30 = await holders(
                await withRule('contract-boolean', contractRule(true, { percent: 30 })),
            );
            expect(at30.size).toBeGreaterThan(at10.size);
            expect([...at10].filter((id) => !at30.has(id))).toEqual([]);
        });

        it('serves the variation to allow-listed users and workspaces, whatever the percentage', async () => {
            const provider = await withRule(
                'contract-boolean',
                contractRule(true, {
                    percent: 0,
                    allowList: { userIds: ['vip'], workspaceIds: ['the-team'] },
                }),
            );
            expect(
                await evaluate(provider, 'contract-boolean', { userId: 'vip', workspaceId: 'x' }),
            ).toBe(true);
            expect(
                await evaluate(provider, 'contract-boolean', { userId: 'vip', workspaceId: null }),
            ).toBe(true);
            expect(
                await evaluate(provider, 'contract-boolean', {
                    userId: 'someone',
                    workspaceId: 'the-team',
                }),
            ).toBe(true);
            expect((await holders(provider)).size).toBe(0);
        });

        it('serves the declared default to everyone, allow-list included, when the flag is off', async () => {
            const provider = await withRule(
                'contract-boolean',
                contractRule(true, {
                    enabled: false,
                    percent: 100,
                    allowList: { userIds: ['vip'], workspaceIds: [] },
                }),
            );
            expect(
                await evaluate(provider, 'contract-boolean', { userId: 'vip', workspaceId: null }),
            ).toBe(false);
            expect((await holders(provider)).size).toBe(0);
        });

        it('serves the declared default for a value that does not match the schema', async () => {
            logged.length = 0;
            const provider = await harness.withRules(
                {
                    'contract-string': contractRule('purple', { percent: 100 }),
                    'contract-number': contractRule(1000, { percent: 100 }),
                },
                options,
            );
            const context = { userId: 'ada', workspaceId: null };
            expect(await evaluate(provider, 'contract-string', context)).toBe('control');
            expect(await evaluate(provider, 'contract-number', context)).toBe(10);
            expect(logged.join('\n')).toMatch(/does not match its schema/);
        });

        it('serves the declared defaults, without throwing, when its backend fails', async () => {
            logged.length = 0;
            const provider = await harness.broken(options);
            const context = { userId: 'ada', workspaceId: 'acme' };
            await expect(evaluate(provider, 'contract-boolean', context)).resolves.toBe(false);
            await expect(provider.evaluateAll(context)).resolves.toMatchObject({
                'contract-string': 'control',
                'contract-json': { tone: 'info', dismissible: true },
            });
            expect(logged.join('\n')).toMatch(/serving the default/);
        });

        it('refuses undeclared keys: at compile time, and with no value at run time', async () => {
            const provider = await harness.withRules({}, options);
            // @ts-expect-error: `evaluate` only takes declared keys.
            const value: unknown = await provider.evaluate('not-declared', {
                userId: 'ada',
                workspaceId: null,
            });
            expect(value).toBeUndefined();
        });
    });
}
