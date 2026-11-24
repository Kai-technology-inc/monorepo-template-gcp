import { Global, Logger, Module } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { readFlagsProviderName, readFlagsTimeoutMs } from '../config/environment';
import { FIREBASE_APP } from '../firebase/firebase-admin.module';
import { Store } from '../persistence/store';
import { CLOCK, type Clock } from '../time/clock';
import { FlagsProvider } from './flags-provider';
import { createFlagsProvider } from './providers';

/**
 * Provides `FlagsProvider` (the adapter `FLAGS_PROVIDER` names) to every module. Inject it where a flag decides
 * something in the API: `flags.evaluate(key, { userId, workspaceId })`, with a key declared in `FLAGS`. Tests
 * provide a `MemoryFlagsProvider` instead (`TestPlatformModule`).
 */
@Global()
@Module({
    providers: [
        {
            provide: FlagsProvider,
            inject: [Store, FIREBASE_APP, CLOCK],
            useFactory: async (store: Store, app: App, clock: Clock): Promise<FlagsProvider> => {
                const name = readFlagsProviderName();
                const provider = await createFlagsProvider(
                    name,
                    { store, app, clock },
                    { timeoutMs: readFlagsTimeoutMs() },
                );
                Logger.log(`Feature flags from ${provider.name}`, 'Flags');
                return provider;
            },
        },
    ],
    exports: [FlagsProvider],
})
export class FlagsModule {}
