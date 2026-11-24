import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    defineFlag,
    FLAG_DEFAULTS,
    FLAG_KEYS,
    flagDefinition,
    FlagKeySchema,
    FlagValuesSchema,
    isFlagKey,
    SetFlagRuleRequestSchema,
} from './flags';
import { SessionSchema } from './session';
import { LITERAL_SEGMENT } from './url-vocabulary';

describe('declared flags', () => {
    it.each(FLAG_KEYS)('%s has a kebab-case key, a valid default and a date', (key) => {
        const definition = flagDefinition(key);
        expect(LITERAL_SEGMENT.test(key)).toBe(true);
        expect(key.length).toBeLessThanOrEqual(64);
        expect(definition.schema.safeParse(definition.defaultValue).success).toBe(true);
        expect(definition.description.trim()).not.toBe('');
        expect(z.iso.date().safeParse(definition.addedOn).success).toBe(true);
    });

    it('tells declared keys from anything else', () => {
        expect(isFlagKey('dashboard-whats-new')).toBe(true);
        expect(isFlagKey('not-declared')).toBe(false);
        expect(isFlagKey('toString')).toBe(false);
        expect(FlagKeySchema.safeParse('not-declared').success).toBe(false);
    });
});

describe('evaluated flags in the session', () => {
    it('fill a missing or malformed value with the declared default', () => {
        expect(FlagValuesSchema.parse({})).toEqual(FLAG_DEFAULTS);
        expect(FlagValuesSchema.parse(undefined)).toEqual(FLAG_DEFAULTS);
        expect(FlagValuesSchema.parse({ 'dashboard-whats-new': 'yes' })).toEqual(FLAG_DEFAULTS);
        expect(FlagValuesSchema.parse({ 'dashboard-whats-new': true })).toMatchObject({
            'dashboard-whats-new': true,
        });
    });

    it('drop keys the web does not declare', () => {
        expect(FlagValuesSchema.parse({ 'from-a-newer-api': true })).toEqual(FLAG_DEFAULTS);
    });

    it('do not break a session that has none (an API older than the web)', () => {
        const session = SessionSchema.shape.flags.parse(undefined);
        expect(session).toEqual(FLAG_DEFAULTS);
    });
});

describe('flag kinds', () => {
    it('validate JSON flags with their own schema', () => {
        const banner = defineFlag.json(z.object({ tone: z.enum(['info', 'warning']) }), {
            defaultValue: { tone: 'info' },
            description: 'A test flag.',
            addedOn: '2026-01-01',
        });
        expect(banner.type).toBe('json');
        expect(banner.schema.safeParse({ tone: 'warning' }).success).toBe(true);
        expect(banner.schema.safeParse({ tone: 'loud' }).success).toBe(false);
        expect(
            defineFlag.number({ defaultValue: 3, description: 'x', addedOn: '2026-01-01' }).type,
        ).toBe('number');
        expect(
            defineFlag.string({ defaultValue: 'a', description: 'x', addedOn: '2026-01-01' }).type,
        ).toBe('string');
    });
});

describe('SetFlagRuleRequest', () => {
    it('needs only the value: nobody gets it until a percentage or an allow-list says so', () => {
        expect(SetFlagRuleRequestSchema.parse({ value: true })).toEqual({
            enabled: true,
            value: true,
            percent: 0,
            bucketBy: 'user',
            allowList: { userIds: [], workspaceIds: [] },
        });
    });

    it('rejects unknown fields and out-of-range percentages', () => {
        expect(SetFlagRuleRequestSchema.safeParse({ value: true, everyone: true }).success).toBe(
            false,
        );
        expect(SetFlagRuleRequestSchema.safeParse({ value: true, percent: 101 }).success).toBe(
            false,
        );
        expect(
            SetFlagRuleRequestSchema.safeParse({ value: true, allowList: { userIds: ['a/b'] } })
                .success,
        ).toBe(false);
    });
});
