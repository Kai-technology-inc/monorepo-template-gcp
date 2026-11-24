/**
 * THE WEB'S CONFIGURATION, READ ONCE
 *
 * Only `NEXT_PUBLIC_*` variables reach the browser, and Next inlines them at build time only when they are written
 * out literally (`process.env.NEXT_PUBLIC_X`), so each one is named here exactly once. Nothing secret belongs here:
 * the Firebase web config is public by design; access is decided by Auth, the API and the security rules.
 */
export interface WebEnv {
    readonly apiBaseUrl: string;
    readonly appEnvironment: string;
    readonly useFirebaseEmulators: boolean;
    /** Where the Auth emulator listens (`host:port`); the browser tests run their own on another port. */
    readonly authEmulatorHost: string;
    readonly firebase: {
        readonly apiKey: string;
        readonly authDomain: string;
        readonly projectId: string;
        readonly appId?: string;
        readonly storageBucket?: string;
        readonly messagingSenderId?: string;
    };
}

export function readWebEnv(): WebEnv {
    return {
        apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100').replace(
            /\/+$/,
            '',
        ),
        appEnvironment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? 'local',
        useFirebaseEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true',
        authEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
        firebase: {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
            authDomain:
                process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-template.firebaseapp.com',
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-template',
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
        },
    };
}
