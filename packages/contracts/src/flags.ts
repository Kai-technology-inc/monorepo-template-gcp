import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './primitives';

/**
 * FEATURE FLAGS, DECLARED ONCE
 *
 * Deploying is not releasing: a user-visible change ships switched off, behind a flag declared here, and is turned
 * on later (for the team, a percentage, everyone) without a deploy. docs/FLAGS.md is the whole story.
 *
 * Each flag has a key (English kebab-case, like a URL segment), a value type checked by a zod schema, and the
 * default every context gets when nothing targets it or the provider fails. The API evaluates flags (never the
 * browser) and sends the values with the session; the web reads them with `useFlag(key)`.
 *
 * This list is also the inventory a cleanup pass reads: `apps/api/src/arch/flags.spec.ts` fails if code asks for
 * a key that is not here, or if a key here is no longer used anywhere. A flag that is fully rolled out is debt:
 * remove the branch in the code, then the line here.
 */
export const FLAG_TYPES = ['boolean', 'string', 'number', 'json'] as const;
export type FlagType = (typeof FLAG_TYPES)[number];

export interface FlagDefinition<T = unknown> {
    readonly type: FlagType;
    readonly schema: z.ZodType<T>;
    /** What every context gets when nothing targets it, the flag is off, or the provider fails. */
    readonly defaultValue: T;
    /** What it gates. For developers and the cleanup pass, never shown to a person: English, one sentence. */
    readonly description: string;
    /** When it was declared (`YYYY-MM-DD`): an old, fully rolled out flag is the first one to remove. */
    readonly addedOn: string;
}

interface FlagMeta<T> {
    readonly defaultValue: T;
    readonly description: string;
    readonly addedOn: string;
}

/** The four kinds of flag. JSON flags bring their own schema; providers' values that do not match it are ignored. */
export const defineFlag = {
    boolean: (meta: FlagMeta<boolean>): FlagDefinition<boolean> => ({
        type: 'boolean',
        schema: z.boolean(),
        ...meta,
    }),
    string: (
        meta: FlagMeta<string>,
        schema: z.ZodType<string> = z.string(),
    ): FlagDefinition<string> => ({
        type: 'string',
        schema,
        ...meta,
    }),
    number: (
        meta: FlagMeta<number>,
        schema: z.ZodType<number> = z.number(),
    ): FlagDefinition<number> => ({
        type: 'number',
        schema,
        ...meta,
    }),
    json: <T>(schema: z.ZodType<T>, meta: FlagMeta<T>): FlagDefinition<T> => ({
        type: 'json',
        schema,
        ...meta,
    }),
};

/**
 * THE FLAGS OF THIS PRODUCT
 *
 * Add one: a line here, then `useFlag('your-key')` in the screen (or `flags.evaluate('your-key', context)` in the
 * API). Remove one when it is fully rolled out: delete the branch that reads it, then this line.
 */
export const FLAGS = {
    'dashboard-whats-new': defineFlag.boolean({
        defaultValue: false,
        description:
            'Shows the "What\'s new" card on the dashboard: the example of a change released behind a flag.',
        addedOn: '2026-11-24',
    }),
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FLAGS;
export type FlagValue<K extends FlagKey> =
    (typeof FLAGS)[K] extends FlagDefinition<infer T> ? T : never;
export type FlagValues = { readonly [K in FlagKey]: FlagValue<K> };

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export function isFlagKey(value: unknown): value is FlagKey {
    return typeof value === 'string' && Object.hasOwn(FLAGS, value);
}

/** The definition of a declared flag, without the per-key generics (for code that walks every flag). */
export function flagDefinition(key: FlagKey): FlagDefinition {
    const definition: FlagDefinition = FLAGS[key];
    return definition;
}

export const FlagKeySchema = z.custom<FlagKey>(isFlagKey, { error: 'Not a declared flag' });

/** Every flag at its declared default. */
export const FLAG_DEFAULTS = Object.fromEntries(
    FLAG_KEYS.map((key) => [key, flagDefinition(key).defaultValue]),
) as FlagValues;

/**
 * The evaluated flags the API sends with the session. A missing or malformed value becomes the declared default
 * instead of failing the whole session: a web deployed before or after the API keeps working.
 */
export const FlagValuesSchema = z
    .object(
        Object.fromEntries(
            FLAG_KEYS.map((key) => {
                const definition = flagDefinition(key);
                return [key, definition.schema.catch(definition.defaultValue)];
            }),
        ),
    )
    .default(FLAG_DEFAULTS) as unknown as z.ZodType<FlagValues>;

// ---------------------------------------------------------------------------------------------------------------
// Operating flags with the own provider (Firestore). LaunchDarkly and Remote Config are operated from their consoles.
// ---------------------------------------------------------------------------------------------------------------

/** What a percentage rollout splits: people, or whole workspaces (everyone in a team sees the same). */
export const FLAG_BUCKETS = ['user', 'workspace'] as const;
export const FlagBucketSchema = z.enum(FLAG_BUCKETS);
export type FlagBucket = z.infer<typeof FlagBucketSchema>;

/** How many ids an allow-list holds. Beyond a team, a percentage is the tool. */
export const FLAG_ALLOW_LIST_MAX = 500;

/**
 * WHO GETS A FLAG (the own provider)
 *
 * Two variations: `value`, and the declared default. In order: `enabled: false` → everyone gets the default; a
 * context whose user or workspace is allow-listed → `value`; a context whose bucket (a stable hash of the flag key
 * and the user or workspace id) falls under `percent` → `value`; anyone else → the default. Raising `percent`
 * keeps everyone who already had `value`, so a rollout only grows.
 *
 * - off: `enabled: false` (or no rule at all)
 * - everyone: `percent: 100`
 * - percentage: `percent: 10`
 * - allow-list (the team first): `allowList.workspaceIds: [<your workspace>]`
 */
export const FlagRuleSchema = z.object({
    enabled: z.boolean(),
    value: z.json(),
    percent: z.number().min(0).max(100),
    bucketBy: FlagBucketSchema,
    allowList: z.object({
        userIds: z.array(IdSchema).max(FLAG_ALLOW_LIST_MAX),
        workspaceIds: z.array(IdSchema).max(FLAG_ALLOW_LIST_MAX),
    }),
});
export type FlagRule = z.infer<typeof FlagRuleSchema>;

/**
 * `PUT /workspaces/:workspaceId/flags/:flagKey`. Only `value` is required: `{ "value": true }` is "nobody yet",
 * `{ "value": true, "percent": 100 }` is "everyone". `value` must match the flag's schema (`400` otherwise).
 */
export const SetFlagRuleRequestSchema = z.strictObject({
    enabled: z.boolean().default(true),
    value: z.json(),
    percent: z.number().min(0).max(100).default(0),
    bucketBy: FlagBucketSchema.default('user'),
    allowList: z
        .strictObject({
            userIds: z.array(IdSchema).max(FLAG_ALLOW_LIST_MAX).default([]),
            workspaceIds: z.array(IdSchema).max(FLAG_ALLOW_LIST_MAX).default([]),
        })
        .default({ userIds: [], workspaceIds: [] }),
});
/** What a client sends (defaults filled in by the API). */
export type SetFlagRuleRequest = z.input<typeof SetFlagRuleRequestSchema>;

/** A declared flag and, with the own provider, the rule that decides who gets it (`null`: the default for all). */
export const FlagStateSchema = z.object({
    key: FlagKeySchema,
    type: z.enum(FLAG_TYPES),
    description: z.string(),
    addedOn: z.iso.date(),
    defaultValue: z.json(),
    rule: FlagRuleSchema.nullable(),
    updatedAt: IsoDateTimeSchema.nullable(),
    updatedBy: IdSchema.nullable(),
});
export type FlagState = z.infer<typeof FlagStateSchema>;

export const FlagListResponseSchema = z.object({
    /** The provider that answered (`FLAGS_PROVIDER`): always the own one, the others are operated elsewhere. */
    provider: z.string(),
    flags: z.array(FlagStateSchema),
});
export type FlagListResponse = z.infer<typeof FlagListResponseSchema>;
