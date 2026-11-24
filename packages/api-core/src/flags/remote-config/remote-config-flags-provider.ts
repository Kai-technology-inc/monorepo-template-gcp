import type { App } from 'firebase-admin/app';
import {
    getRemoteConfig,
    type EvaluationContext,
    type ServerTemplate,
    type ServerTemplateDataType,
    type Value,
} from 'firebase-admin/remote-config';
import type { FlagType } from '@app/contracts';
import { FlagsProvider, type FlagContext, type FlagsProviderOptions } from '../flags-provider';

/**
 * Remote Config parameter names take letters, digits and `_`, so the flag `dashboard-whats-new` is the parameter
 * `dashboard_whats_new`.
 */
export function remoteConfigParameter(key: string): string {
    return key.replace(/-/g, '_');
}

export interface RemoteConfigFlagsProviderOptions extends FlagsProviderOptions {
    /** How long a loaded template is used before loading it again (`FLAGS_CACHE_SECONDS`). */
    readonly refreshMs?: number;
}

/**
 * FIREBASE REMOTE CONFIG, SERVER SIDE (`FLAGS_PROVIDER=remote-config`)
 *
 * The project's **server** template (Remote Config → Server in the console; not the client template), loaded with
 * the Admin SDK and evaluated in memory, refreshed every `refreshMs`. Each flag is a parameter
 * (`remoteConfigParameter`) whose default is "use in-app default", with conditional values for whoever gets it:
 *
 * - percentage: a percent condition. `randomizationId` is the user id, so Remote Config splits by person;
 * - allow-list: a custom-signal condition on `userId` or `workspaceId` (exact match);
 * - everything else in the context travels as custom signals (`attributes`, as strings).
 *
 * The runtime service account needs read access to Remote Config (`roles/cloudconfig.viewer`).
 */
export class RemoteConfigFlagsProvider extends FlagsProvider {
    readonly name = 'remote-config';
    private readonly refreshMs: number;
    private loadedAt = 0;
    private loading: Promise<void> | null = null;

    /** The project's server template, loaded now and every `refreshMs`. */
    static connect(
        app: App,
        options: RemoteConfigFlagsProviderOptions = {},
    ): RemoteConfigFlagsProvider {
        const template = getRemoteConfig(app).initServerTemplate();
        const provider = new RemoteConfigFlagsProvider(template, () => template.load(), options);
        provider.fresh().catch(() => undefined);
        return provider;
    }

    /** A template you already hold (a JSON export, a spec). It is never fetched. */
    static fromTemplate(
        app: App,
        template: ServerTemplateDataType,
        options: RemoteConfigFlagsProviderOptions = {},
    ): RemoteConfigFlagsProvider {
        return new RemoteConfigFlagsProvider(
            getRemoteConfig(app).initServerTemplate({ template }),
            null,
            options,
        );
    }

    constructor(
        private readonly template: ServerTemplate,
        private readonly load: (() => Promise<void>) | null,
        options: RemoteConfigFlagsProviderOptions = {},
    ) {
        super(options);
        this.refreshMs = options.refreshMs ?? 15_000;
    }

    protected async variation(key: string, context: FlagContext): Promise<unknown> {
        const type = this.definitionOf(key)?.type ?? 'string';
        await this.fresh();
        const value = this.template
            .evaluate(remoteConfigSignals(context))
            .getValue(remoteConfigParameter(key));
        // `static`: no such parameter; `default`: in-app defaults, which the template does not use. Either way,
        // the declared default.
        if (value.getSource() !== 'remote') return undefined;
        return decode(type, value);
    }

    /**
     * Until the first load succeeds, every evaluation waits for (and retries) it. After that, a stale template is
     * refreshed in the background while the old one keeps answering.
     */
    private fresh(): Promise<void> {
        if (!this.load) return Promise.resolve();
        const load = this.load;
        const start = (): Promise<void> => {
            this.loading ??= load()
                .then(() => {
                    this.loadedAt = Date.now();
                })
                .finally(() => {
                    this.loading = null;
                });
            return this.loading;
        };
        if (this.loadedAt === 0) return start();
        if (Date.now() - this.loadedAt >= this.refreshMs) {
            start().catch((error: unknown) => {
                this.logger.warn(`Remote Config: refresh failed (${String(error)})`);
            });
        }
        return Promise.resolve();
    }
}

/** `FlagContext` → Remote Config's evaluation context: `randomizationId` and custom signals. */
export function remoteConfigSignals(context: FlagContext): EvaluationContext {
    const signals: EvaluationContext = {
        randomizationId: context.userId,
        userId: context.userId,
    };
    if (context.workspaceId) signals.workspaceId = context.workspaceId;
    for (const [name, value] of Object.entries(context.attributes ?? {})) {
        if (!(name in signals)) signals[name] = typeof value === 'number' ? value : String(value);
    }
    return signals;
}

function decode(type: FlagType, value: Value): unknown {
    switch (type) {
        case 'boolean':
            return value.asBoolean();
        case 'number':
            return value.asNumber();
        case 'string':
            return value.asString();
        case 'json':
            return JSON.parse(value.asString()) as unknown;
    }
}
