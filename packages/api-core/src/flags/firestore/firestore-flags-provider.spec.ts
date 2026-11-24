import { describe, expect, it } from 'vitest';
import { paths } from '../../persistence/paths';
import type { QueryOptions, StoredDocument, Where } from '../../persistence/store';
import { contractRule, describeFlagsProviderContract } from '../../testing/flags-provider-contract';
import { InMemoryStore } from '../../testing/in-memory-store';
import { fixedClock } from '../../time/clock';
import { FirestoreFlagsProvider } from './firestore-flags-provider';

/** Counts how many times the rules were read, and fails the reads while `unavailable` (Firestore down). */
class ObservedStore extends InMemoryStore {
    reads = 0;
    unavailable = false;

    override query(
        path: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        this.reads += 1;
        if (this.unavailable) return Promise.reject(new Error('UNAVAILABLE'));
        return super.query(path, filters, options);
    }
}

/**
 * The own provider: the rule is a document, `flags/{flagKey}`, written by the admin routes. These specs run it over
 * `InMemoryStore`; the emulator and production run it over Firestore through the same `Store`.
 */
describeFlagsProviderContract('firestore', {
    withRules: async (rules, options) => {
        const provider = new FirestoreFlagsProvider(new InMemoryStore(), {
            ...options,
            cacheMs: 60_000,
        });
        for (const [key, rule] of Object.entries(rules)) {
            await provider.writeRule(key, rule, 'spec');
        }
        return provider;
    },
    broken: (options) => {
        const store = new ObservedStore();
        store.unavailable = true;
        return Promise.resolve(new FirestoreFlagsProvider(store, options));
    },
});

describe('FirestoreFlagsProvider', () => {
    const quiet = { warn: () => undefined, error: () => undefined };
    const key = 'dashboard-whats-new';

    it('splits by workspace when asked: everyone in a workspace gets the same', async () => {
        const provider = new FirestoreFlagsProvider(new InMemoryStore(), { logger: quiet });
        await provider.writeRule(
            key,
            contractRule(true, { percent: 50, bucketBy: 'workspace' }),
            'ada',
        );
        const byWorkspace = new Map<string, Set<boolean>>();
        for (let user = 0; user < 400; user += 1) {
            const workspaceId = `w${user % 20}`;
            const value = await provider.evaluate(key, { userId: `u${user}`, workspaceId });
            byWorkspace.set(workspaceId, (byWorkspace.get(workspaceId) ?? new Set()).add(value));
        }
        expect([...byWorkspace.values()].every((values) => values.size === 1)).toBe(true);
        const holding = [...byWorkspace.values()].filter((values) => values.has(true)).length;
        expect(holding).toBeGreaterThan(3);
        expect(holding).toBeLessThan(17);
        expect(await provider.evaluate(key, { userId: 'u1', workspaceId: null })).toBe(false);
    });

    it('reads the rules once per cache period, and at once after a change on this instance', async () => {
        const store = new ObservedStore();
        const provider = new FirestoreFlagsProvider(store, { cacheMs: 60_000, logger: quiet });
        const context = { userId: 'ada', workspaceId: 'acme' };
        await Promise.all([provider.evaluateAll(context), provider.evaluateAll(context)]);
        expect(store.reads).toBe(1);
        await provider.writeRule(key, contractRule(true, { percent: 100 }), 'ada');
        expect(await provider.evaluate(key, context)).toBe(true);
        await provider.deleteRule(key);
        expect(await provider.evaluate(key, context)).toBe(false);
        expect(store.reads).toBe(3);
    });

    it('stores who changed a rule and when, and any JSON value', async () => {
        const store = new InMemoryStore();
        const provider = new FirestoreFlagsProvider(store, {
            clock: fixedClock('2026-11-24T10:00:00.000Z'),
            logger: quiet,
        });
        const rule = contractRule([[1, 2], { nested: [null] }], { percent: 5 });
        await provider.writeRule(key, rule, 'ada');
        expect(await store.get(paths.flag(key))).toMatchObject({
            valueJson: '[[1,2],{"nested":[null]}]',
            updatedAt: '2026-11-24T10:00:00.000Z',
            updatedBy: 'ada',
        });
        expect(await provider.readRule(key)).toEqual({
            rule,
            updatedAt: '2026-11-24T10:00:00.000Z',
            updatedBy: 'ada',
        });
    });

    it('ignores rules of undeclared flags and documents that do not match the schema', async () => {
        const store = new InMemoryStore();
        const warnings: string[] = [];
        store.seed(paths.flag('removed-long-ago'), { enabled: true });
        store.seed(paths.flag(key), { enabled: 'yes' });
        const provider = new FirestoreFlagsProvider(store, {
            logger: { warn: (m: unknown) => warnings.push(String(m)), error: () => undefined },
        });
        expect([...(await provider.readRules()).keys()]).toEqual([]);
        expect(await provider.evaluate(key, { userId: 'ada', workspaceId: null })).toBe(false);
        expect(new Set(warnings)).toEqual(
            new Set(['flags/dashboard-whats-new does not match its schema; ignored']),
        );
    });

    it('does not keep a failed read: the next evaluation reads again', async () => {
        const store = new ObservedStore();
        const provider = new FirestoreFlagsProvider(store, { cacheMs: 60_000, logger: quiet });
        await provider.writeRule(key, contractRule(true, { percent: 100 }), 'ada');
        const context = { userId: 'ada', workspaceId: null };
        store.unavailable = true;
        expect(await provider.evaluate(key, context)).toBe(false);
        store.unavailable = false;
        expect(await provider.evaluate(key, context)).toBe(true);
    });
});
