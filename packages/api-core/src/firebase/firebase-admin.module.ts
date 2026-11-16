import { Global, Injectable, Inject, Module } from '@nestjs/common';
import { getApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertSafeEnvironment, readProjectId } from '../config/environment';

export const FIREBASE_APP = Symbol('FIREBASE_APP');

const configured = new WeakSet<App>();

/**
 * The default Admin app, created if nobody did before. It cannot be decided by counting `getApps()`: inside a
 * Firestore trigger, `firebase-functions` creates an app of its own before ours, so the list is not empty and there
 * is still no default app. Asking for it and creating it when missing is the test that tells both apart.
 *
 * Credentials: Application Default Credentials (the runtime service account when deployed, `gcloud auth
 * application-default login` locally). With `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` set, the SDK
 * talks to the emulators and needs none.
 */
export function resolveFirebaseApp(): App {
    assertSafeEnvironment();
    let app: App;
    try {
        app = getApp();
    } catch {
        const projectId = readProjectId();
        app = initializeApp(projectId ? { projectId } : {});
    }
    if (!configured.has(app)) {
        // Absence is an explicit `null`; this is only the safety net.
        getFirestore(app).settings({ ignoreUndefinedProperties: true });
        configured.add(app);
    }
    return app;
}

/** What the guard needs from a verified ID token. */
export interface VerifiedToken {
    readonly uid: string;
    readonly email?: string;
    readonly email_verified?: boolean;
    readonly name?: string;
}

/** Verifies Firebase ID tokens. An abstract class so tests can provide a fake. */
export abstract class IdTokenVerifier {
    abstract verifyIdToken(token: string): Promise<VerifiedToken>;
}

@Injectable()
export class FirebaseIdTokenVerifier extends IdTokenVerifier {
    constructor(@Inject(FIREBASE_APP) private readonly app: App) {
        super();
    }

    async verifyIdToken(token: string): Promise<VerifiedToken> {
        // Loaded on first use: `firebase-admin/auth` pulls an ESM-only dependency (jose) that the test runner cannot
        // load, and nothing but this method needs it.
        const { getAuth } = await import('firebase-admin/auth');
        // `checkRevoked` costs one Auth read per request; enable it if you revoke sessions (password change, abuse).
        const decoded = await getAuth(this.app).verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email,
            email_verified: decoded.email_verified,
            name: typeof decoded.name === 'string' ? decoded.name : undefined,
        };
    }
}

@Global()
@Module({
    providers: [
        { provide: FIREBASE_APP, useFactory: resolveFirebaseApp },
        { provide: IdTokenVerifier, useClass: FirebaseIdTokenVerifier },
    ],
    exports: [FIREBASE_APP, IdTokenVerifier],
})
export class FirebaseAdminModule {}
