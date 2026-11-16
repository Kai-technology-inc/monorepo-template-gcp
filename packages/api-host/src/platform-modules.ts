import type { Type } from '@nestjs/common';
import { AuthModule } from '@app/api-core/auth/auth.module';
import { FirebaseAdminModule } from '@app/api-core/firebase/firebase-admin.module';
import { PersistenceModule } from '@app/api-core/persistence/persistence.module';
import { ClockModule } from '@app/api-core/time/clock.module';

/**
 * What every Nest instance carries, whoever it belongs to: Firebase Admin, the Store, the clock and the global auth
 * guard. The product modules (`AccountModule`, `WorkspacesModule`, yours) go on top.
 */
export const PLATFORM_MODULES: readonly Type<unknown>[] = [
    FirebaseAdminModule,
    PersistenceModule,
    ClockModule,
    AuthModule,
];
