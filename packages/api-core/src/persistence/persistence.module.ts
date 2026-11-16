import { Global, Module } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import { FIREBASE_APP } from '../firebase/firebase-admin.module';
import { FirestoreStore } from './firestore-store';
import { Store } from './store';

/** Provides `Store` backed by Firestore. Tests replace it with `InMemoryStore` (`overrideProvider(Store)`). */
@Global()
@Module({
    providers: [
        {
            provide: Store,
            inject: [FIREBASE_APP],
            useFactory: (app: App) => new FirestoreStore(app),
        },
    ],
    exports: [Store],
})
export class PersistenceModule {}
