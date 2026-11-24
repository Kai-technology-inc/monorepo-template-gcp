import { Logger, type LoggerService, type OnModuleDestroy } from '@nestjs/common';
import {
    FLAGS,
    type FlagDefinition,
    type FlagKey,
    type FlagValue,
    type FlagValues,
} from '@app/contracts';

/** The flags a provider evaluates: `FLAGS` (@app/contracts) in the app, a registry of their own in the shared spec. */
export type FlagRegistry = Readonly<Record<string, FlagDefinition>>;

/**
 * Who a flag is evaluated for. `userId` and `workspaceId` are what percentage rollouts and allow-lists key on;
 * `attributes` are extra targeting data a provider may use (LaunchDarkly rules, Remote Config custom signals).
 * Never put secrets or personal data a vendor should not hold (emails, names) in it.
 */
export interface FlagContext {
    readonly userId: string;
    readonly workspaceId: string | null;
    readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface FlagsProviderOptions {
    /** The declared flags. Defaults to `FLAGS`; the shared spec brings its own so it does not depend on yours. */
    readonly flags?: FlagRegistry;
    /** How long one evaluation may take before the declared default is served (`FLAGS_TIMEOUT_MS`). */
    readonly timeoutMs?: number;
    readonly logger?: Pick<LoggerService, 'warn' | 'error'>;
}

/**
 * THE FEATURE-FLAGS PORT
 *
 * What the rest of the API asks: "which variation of this flag does this context get?". An adapter (Firestore,
 * LaunchDarkly, Remote Config, memory: `FLAGS_PROVIDER`) implements one method, `variation()`, and may fail in any
 * way: throw, hang, answer garbage. `evaluate()` is written once, here, and turns all of that into the flag's
 * declared default plus a log line, so a flag never fails a request:
 *
 *   timeout (`FLAGS_TIMEOUT_MS`) → default · error → default · value that does not match the flag's schema →
 *   default · `undefined` (nothing targets the flag) → default
 *
 * Keys are typed: `evaluate('not-declared', …)` does not compile. A new adapter is ready when it passes the shared
 * spec (`testing/flags-provider-contract.ts`, docs/FLAGS.md).
 */
export abstract class FlagsProvider implements OnModuleDestroy {
    /** The adapter, as `FLAGS_PROVIDER` names it (`firestore`, `launchdarkly`…): it appears in the logs. */
    abstract readonly name: string;

    protected readonly logger: Pick<LoggerService, 'warn' | 'error'>;
    private readonly flags: FlagRegistry;
    private readonly timeoutMs: number;

    constructor(options: FlagsProviderOptions = {}) {
        this.flags = options.flags ?? FLAGS;
        this.timeoutMs = options.timeoutMs ?? 1000;
        this.logger = options.logger ?? new Logger('Flags');
    }

    /** The variation `context` gets for `key`. Never throws: on any failure, the declared default. */
    async evaluate<K extends FlagKey>(key: K, context: FlagContext): Promise<FlagValue<K>> {
        const definition = this.definitionOf(key);
        if (!definition) {
            // Only reachable through a cast: the type system already refuses undeclared keys.
            this.logger.error(`Flag "${String(key)}" is not declared in FLAGS (@app/contracts)`);
            return undefined as FlagValue<K>;
        }
        try {
            const raw = await withTimeout(this.variation(key, context), this.timeoutMs);
            if (raw === undefined) return definition.defaultValue as FlagValue<K>;
            const parsed = definition.schema.safeParse(raw);
            if (parsed.success) return parsed.data as FlagValue<K>;
            this.logger.warn(
                `Flag ${key}: ${this.name} served a value that does not match its schema; serving the default`,
            );
        } catch (error) {
            this.logger.warn(
                `Flag ${key}: ${this.name} failed (${describe(error)}); serving the default`,
            );
        }
        return definition.defaultValue as FlagValue<K>;
    }

    /** Every declared flag for `context`: what the session carries to the web. Never throws. */
    async evaluateAll(context: FlagContext): Promise<FlagValues> {
        const entries = await Promise.all(
            Object.keys(this.flags).map(
                async (key) => [key, await this.evaluate(key as FlagKey, context)] as const,
            ),
        );
        return Object.fromEntries(entries) as FlagValues;
    }

    /**
     * The adapter's half: the raw variation of a declared flag for `context`, or `undefined` when nothing in the
     * provider targets it (the declared default applies). It may throw or never resolve; `evaluate()` covers both.
     */
    protected abstract variation(key: string, context: FlagContext): Promise<unknown>;

    /** The declaration of `key` in this provider's registry, or `undefined` if it is not declared. */
    protected definitionOf(key: string): FlagDefinition | undefined {
        return Object.hasOwn(this.flags, key) ? this.flags[key] : undefined;
    }

    /** Releases connections (LaunchDarkly's stream). Called when the Nest app closes. */
    close(): Promise<void> {
        return Promise.resolve();
    }

    async onModuleDestroy(): Promise<void> {
        await this.close();
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
        timer.unref();
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
