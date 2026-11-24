import { z } from 'zod';
import { FlagRuleSchema, IdSchema, IsoDateTimeSchema, type FlagRule } from '@app/contracts';
import { paths } from '../../persistence/paths';
import type { Store } from '../../persistence/store';
import { systemClock, type Clock } from '../../time/clock';
import { FlagsProvider, type FlagContext, type FlagsProviderOptions } from '../flags-provider';
import { variationOf } from '../rule';

/**
 * `flags/{flagKey}`: a rule plus who changed it last. `value` is stored as JSON text: Firestore cannot hold every
 * JSON value (an array inside an array), and a flag's value is whatever its schema allows.
 */
const FlagRuleRecordSchema = FlagRuleSchema.omit({ value: true }).extend({
    valueJson: z.string(),
    updatedAt: IsoDateTimeSchema,
    updatedBy: IdSchema,
});

/** A stored rule, as the admin routes show it. */
export interface StoredFlagRule {
    readonly rule: FlagRule;
    readonly updatedAt: string;
    readonly updatedBy: string;
}

export interface FirestoreFlagsProviderOptions extends FlagsProviderOptions {
    /** How long rules are kept in memory before reading them again (`FLAGS_CACHE_SECONDS`). */
    readonly cacheMs?: number;
    readonly clock?: Clock;
}

interface CacheEntry {
    readonly at: number;
    readonly rules: Promise<ReadonlyMap<string, StoredFlagRule>>;
    settled: boolean;
}

/**
 * THE OWN PROVIDER: FLAG RULES IN FIRESTORE (the default)
 *
 * One document per flag that has a rule (`flags/{flagKey}`), written only by the API (the admin routes,
 * docs/API.md) and denied to clients by `firestore.rules`. Rules are read once per `cacheMs` per instance (one
 * query for all flags) and evaluated in memory with `variationOf`: on/off, a value for everyone, a percentage with a
 * stable bucket per user or workspace, and an allow-list of user and workspace ids.
 *
 * It reads through `Store`, so it runs on the emulators, in production, and over `InMemoryStore` in specs.
 */
export class FirestoreFlagsProvider extends FlagsProvider {
    readonly name = 'firestore';
    private readonly cacheMs: number;
    private readonly clock: Clock;
    private cache: CacheEntry | null = null;

    constructor(
        private readonly store: Store,
        options: FirestoreFlagsProviderOptions = {},
    ) {
        super(options);
        this.cacheMs = options.cacheMs ?? 15_000;
        this.clock = options.clock ?? systemClock;
    }

    protected async variation(key: string, context: FlagContext): Promise<unknown> {
        const stored = (await this.cachedRules()).get(key);
        return stored ? variationOf(key, stored.rule, context) : undefined;
    }

    /** Every stored rule of a declared flag, read now (the admin routes never show a cached state). */
    async readRules(): Promise<ReadonlyMap<string, StoredFlagRule>> {
        const documents = await this.store.query(paths.flags());
        const rules = new Map<string, StoredFlagRule>();
        for (const document of documents) {
            // A rule left behind by a flag removed from FLAGS: harmless, and ignored.
            if (!this.definitionOf(document.id)) continue;
            const stored = toStoredRule(document.data);
            if (stored) rules.set(document.id, stored);
            else this.logger.warn(`${document.path} does not match its schema; ignored`);
        }
        return rules;
    }

    async readRule(key: string): Promise<StoredFlagRule | null> {
        const data = await this.store.get(paths.flag(key));
        return data ? toStoredRule(data) : null;
    }

    /** Stores who gets `key`. Takes effect at once on this instance, within `cacheMs` on the others. */
    async writeRule(key: string, rule: FlagRule, updatedBy: string): Promise<StoredFlagRule> {
        const stored: StoredFlagRule = {
            rule,
            updatedAt: this.clock.now().toISOString(),
            updatedBy,
        };
        const { value, ...rest } = rule;
        await this.store.runTransaction((tx) => {
            tx.set(paths.flag(key), {
                ...rest,
                valueJson: JSON.stringify(value),
                updatedAt: stored.updatedAt,
                updatedBy,
            });
            return Promise.resolve();
        });
        this.cache = null;
        return stored;
    }

    /** Removes the rule: everyone gets the declared default (the kill switch). */
    async deleteRule(key: string): Promise<void> {
        await this.store.runTransaction((tx) => {
            tx.delete(paths.flag(key));
            return Promise.resolve();
        });
        this.cache = null;
    }

    /** One read shared by every evaluation in flight and reused for `cacheMs`; a failed read is not kept. */
    private cachedRules(): Promise<ReadonlyMap<string, StoredFlagRule>> {
        const now = Date.now();
        const cached = this.cache;
        if (cached && (!cached.settled || now - cached.at < this.cacheMs)) return cached.rules;
        const entry: CacheEntry = { at: now, rules: this.readRules(), settled: false };
        this.cache = entry;
        entry.rules.then(
            () => {
                entry.settled = true;
            },
            () => {
                if (this.cache === entry) this.cache = null;
            },
        );
        return entry.rules;
    }
}

function toStoredRule(data: unknown): StoredFlagRule | null {
    const parsed = FlagRuleRecordSchema.safeParse(data);
    if (!parsed.success) return null;
    const { valueJson, updatedAt, updatedBy, ...rest } = parsed.data;
    try {
        const value = FlagRuleSchema.shape.value.parse(JSON.parse(valueJson));
        return { rule: { ...rest, value }, updatedAt, updatedBy };
    } catch {
        return null;
    }
}
