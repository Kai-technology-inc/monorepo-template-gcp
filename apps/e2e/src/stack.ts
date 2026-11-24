/**
 * THE BROWSER TESTS' OWN STACK
 *
 * Emulators, API and web on ports and a project of their own, so `pnpm test:e2e` runs next to a `pnpm dev`
 * without touching its data, and every run starts from empty emulators. `playwright.config.ts` boots it.
 */
export const STACK = {
    projectId: 'demo-e2e',
    web: 'http://localhost:3010',
    webPort: 3010,
    api: 'http://localhost:3110',
    apiPort: 3110,
    firestore: '127.0.0.1:8280',
    auth: '127.0.0.1:9399',
} as const;

/** The API as the tests start it: the local server against the e2e emulators. */
export const API_ENV: Readonly<Record<string, string>> = {
    APP_ENVIRONMENT: 'local',
    PORT: String(STACK.apiPort),
    GCLOUD_PROJECT: STACK.projectId,
    FIRESTORE_EMULATOR_HOST: STACK.firestore,
    FIREBASE_AUTH_EMULATOR_HOST: STACK.auth,
    ALLOWED_ORIGINS: STACK.web,
    AUTH_REQUIRE_VERIFIED_EMAIL: 'false',
    FLAGS_PROVIDER: 'firestore',
    // Any workspace's owner may operate flags: honored only because APP_ENVIRONMENT is local.
    FLAGS_ADMIN_WORKSPACE_ID: '*',
};

/** The web as the tests build it (`NEXT_PUBLIC_*` are inlined at build time, in a build folder of its own). */
export const WEB_ENV: Readonly<Record<string, string>> = {
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_PUBLIC_APP_ENVIRONMENT: 'local',
    NEXT_PUBLIC_API_BASE_URL: STACK.api,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: STACK.auth,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: STACK.projectId,
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${STACK.projectId}.firebaseapp.com`,
    NEXT_TELEMETRY_DISABLED: '1',
};
