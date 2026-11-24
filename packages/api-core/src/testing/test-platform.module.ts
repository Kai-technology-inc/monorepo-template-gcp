import { Global, Module, type DynamicModule } from '@nestjs/common';
import { IdTokenVerifier } from '../firebase/firebase-admin.module';
import { FlagsProvider } from '../flags/flags-provider';
import { MemoryFlagsProvider } from '../flags/memory/memory-flags-provider';
import { Store } from '../persistence/store';
import { CLOCK, systemClock, type Clock } from '../time/clock';
import { FakeTokenVerifier } from './fake-token-verifier';
import { InMemoryStore } from './in-memory-store';

/**
 * The platform providers for a test app: an in-memory `Store`, a fake token verifier, a clock and in-memory flags,
 * global like the real ones (`FirebaseAdminModule`, `PersistenceModule`, `FlagsModule`). Import it next to
 * `AuthModule` and the module under test.
 */
@Global()
@Module({})
export class TestPlatformModule {
    static with(
        options: {
            store?: Store;
            verifier?: IdTokenVerifier;
            clock?: Clock;
            flags?: FlagsProvider;
        } = {},
    ): DynamicModule {
        return {
            module: TestPlatformModule,
            providers: [
                { provide: Store, useValue: options.store ?? new InMemoryStore() },
                { provide: IdTokenVerifier, useValue: options.verifier ?? new FakeTokenVerifier() },
                { provide: CLOCK, useValue: options.clock ?? systemClock },
                { provide: FlagsProvider, useValue: options.flags ?? new MemoryFlagsProvider() },
            ],
            exports: [Store, IdTokenVerifier, CLOCK, FlagsProvider],
        };
    }
}
