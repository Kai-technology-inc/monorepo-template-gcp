import {
    basicLogger,
    init,
    type LDClient,
    type LDContext,
    type LDOptions,
} from '@launchdarkly/node-server-sdk';
import { FlagsProvider, type FlagContext, type FlagsProviderOptions } from '../flags-provider';

export interface LaunchDarklyFlagsProviderOptions extends FlagsProviderOptions {
    /** Extra SDK options (a relay proxy, `TestData` in specs). */
    readonly sdk?: LDOptions;
}

/**
 * LAUNCHDARKLY (`FLAGS_PROVIDER=launchdarkly`)
 *
 * The official server SDK evaluates in memory from a stream LaunchDarkly keeps up to date, so an evaluation costs no
 * request. Flags are created and targeted in LaunchDarkly's console, with the same key as in FLAGS; until a flag
 * exists there, everyone gets the declared default.
 *
 * The context is a multi-context: kind `user` (key: the user id, plus the attributes) and kind `workspace` (key:
 * the workspace id). Individual targets on either kind are the allow-list; a percentage rollout "by user" or "by
 * workspace" is the percentage. The SDK key is a Secret Manager secret (`LAUNCHDARKLY_SDK_KEY`).
 */
export class LaunchDarklyFlagsProvider extends FlagsProvider {
    readonly name = 'launchdarkly';
    private readonly ready: Promise<unknown>;

    /** A client for `sdkKey`, streaming from LaunchDarkly. */
    static connect(
        sdkKey: string,
        options: LaunchDarklyFlagsProviderOptions = {},
    ): LaunchDarklyFlagsProvider {
        const client = init(sdkKey, { logger: basicLogger({ level: 'warn' }), ...options.sdk });
        return new LaunchDarklyFlagsProvider(client, options);
    }

    constructor(
        private readonly client: LDClient,
        options: FlagsProviderOptions = {},
    ) {
        super(options);
        // The first evaluations wait for the first payload (each bounded by FLAGS_TIMEOUT_MS). If it never comes,
        // the client answers CLIENT_NOT_READY and callers get the default until it connects.
        this.ready = client.waitForInitialization({ timeout: 10 }).catch(() => undefined);
    }

    protected async variation(key: string, context: FlagContext): Promise<unknown> {
        await this.ready;
        const detail = await this.client.variationDetail(
            key,
            launchDarklyContext(context),
            this.definitionOf(key)?.defaultValue ?? null,
        );
        if (detail.reason.kind !== 'ERROR') return detail.value;
        // Declared in FLAGS, not created in LaunchDarkly yet: the default, quietly.
        if (detail.reason.errorKind === 'FLAG_NOT_FOUND') return undefined;
        throw new Error(`LaunchDarkly ${detail.reason.errorKind ?? 'error'}`);
    }

    override close(): Promise<void> {
        this.client.close();
        return Promise.resolve();
    }
}

/** `FlagContext` → LaunchDarkly's multi-context (`user`, and `workspace` when there is one). */
export function launchDarklyContext(context: FlagContext): LDContext {
    const { kind: _kind, key: _key, ...attributes } = context.attributes ?? {};
    const user = { ...attributes, key: context.userId };
    if (!context.workspaceId) return { kind: 'user', ...user };
    return { kind: 'multi', user, workspace: { key: context.workspaceId } };
}
