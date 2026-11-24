import type { App } from 'firebase-admin/app';
import { readFlagsCacheMs, readLaunchDarklySdkKey } from '../config/environment';
import type { Store } from '../persistence/store';
import type { Clock } from '../time/clock';
import type { FlagsProvider, FlagsProviderOptions } from './flags-provider';

/** What an adapter may need to start. */
export interface FlagsProviderDeps {
    readonly store: Store;
    readonly app: App;
    readonly clock: Clock;
}

type AdapterFactory = (
    deps: FlagsProviderDeps,
    options: FlagsProviderOptions,
) => Promise<FlagsProvider>;

/**
 * THE ADAPTERS, ONE LINE EACH (`FLAGS_PROVIDER` picks one)
 *
 * Each adapter lives in its own folder and is loaded only when chosen, so a deployment never runs an SDK it does not
 * use. Dropping one: delete its folder, its line here, and its SDK from `package.json` (and the catalog). Adding
 * one: a folder that extends `FlagsProvider` and passes the shared spec, and a line here (docs/FLAGS.md).
 */
const ADAPTERS: Readonly<Record<string, AdapterFactory>> = {
    firestore: async ({ store, clock }, options) =>
        new (await import('./firestore/firestore-flags-provider')).FirestoreFlagsProvider(store, {
            ...options,
            clock,
            cacheMs: readFlagsCacheMs(),
        }),
    launchdarkly: async (_deps, options) =>
        (
            await import('./launchdarkly/launchdarkly-flags-provider')
        ).LaunchDarklyFlagsProvider.connect(readLaunchDarklySdkKey(), options),
    'remote-config': async ({ app }, options) =>
        (
            await import('./remote-config/remote-config-flags-provider')
        ).RemoteConfigFlagsProvider.connect(app, { ...options, refreshMs: readFlagsCacheMs() }),
    memory: async (_deps, options) =>
        new (await import('./memory/memory-flags-provider')).MemoryFlagsProvider(options),
};

export const FLAGS_ADAPTERS = Object.keys(ADAPTERS);

/** The adapter called `name`. An unknown name stops the API at boot instead of serving defaults in silence. */
export function createFlagsProvider(
    name: string,
    deps: FlagsProviderDeps,
    options: FlagsProviderOptions = {},
): Promise<FlagsProvider> {
    const factory = Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name] : undefined;
    if (!factory) {
        return Promise.reject(
            new Error(
                `FLAGS_PROVIDER=${name} is not one of ${FLAGS_ADAPTERS.join(', ')} (docs/FLAGS.md).`,
            ),
        );
    }
    return factory(deps, options);
}
