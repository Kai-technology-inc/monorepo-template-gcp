/**
 * EVERYTHING THE API READS FROM THE ENVIRONMENT, IN ONE PLACE
 *
 * No other file reads `process.env` for configuration: a new setting is a function here, with its default and the
 * reason for it. Locally the values come from `apps/api/.env`; deployed, from the `.env` the deploy script writes
 * next to the Functions bundle and from Secret Manager.
 */
export const APP_ENVIRONMENTS = ['local', 'qa', 'prod'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function readEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnvironment {
    const value = env.APP_ENVIRONMENT?.trim().toLowerCase();
    return (APP_ENVIRONMENTS as readonly string[]).includes(value ?? '')
        ? (value as AppEnvironment)
        : 'local';
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
    return readEnvironment(env) === 'prod';
}

/**
 * Origins allowed to call the API from a browser (`ALLOWED_ORIGINS`, comma separated). Empty means no cross-origin
 * call is allowed at all: failing closed is the safe default for an API that serves tenant data.
 */
export function readAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
    return (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

/**
 * Whether workspace routes require a verified email (`AUTH_REQUIRE_VERIFIED_EMAIL`). Defaults to `true` everywhere
 * except `local`, where verification emails only reach the Auth emulator's UI.
 */
export function requiresVerifiedEmail(env: NodeJS.ProcessEnv = process.env): boolean {
    const value = env.AUTH_REQUIRE_VERIFIED_EMAIL?.trim().toLowerCase();
    if (value === 'true') return true;
    if (value === 'false') return false;
    return readEnvironment(env) !== 'local';
}

/** The Google Cloud project: set by the Functions runtime, by the emulator, or by `.env` locally. */
export function readProjectId(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const direct = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? env.FIREBASE_PROJECT_ID;
    if (direct) return direct;
    if (!env.FIREBASE_CONFIG) return undefined;
    try {
        const config = JSON.parse(env.FIREBASE_CONFIG) as { projectId?: unknown };
        return typeof config.projectId === 'string' ? config.projectId : undefined;
    } catch {
        return undefined;
    }
}

/** True when the Admin SDK talks to the local emulators instead of a real project. */
export function usesEmulators(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);
}

export function readNumber(
    name: string,
    fallback: number,
    env: NodeJS.ProcessEnv = process.env,
): number {
    const raw = env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

/**
 * Who evaluates feature flags (`FLAGS_PROVIDER`, docs/FLAGS.md): `firestore` (default), `launchdarkly`,
 * `remote-config` or `memory`. Firestore is the default because a bare template must work with the emulators and
 * without anyone's account. The adapter registry (`flags/providers.ts`) refuses an unknown name at boot.
 */
export function readFlagsProviderName(env: NodeJS.ProcessEnv = process.env): string {
    return env.FLAGS_PROVIDER?.trim().toLowerCase() || 'firestore';
}

/**
 * How long the API keeps flag rules in memory before reading them again (`FLAGS_CACHE_SECONDS`, default 15): the
 * Firestore provider's rules and Remote Config's template. Changing a flag reaches every instance within this time
 * (immediately on the instance that changed it). LaunchDarkly streams its changes and ignores it.
 */
export function readFlagsCacheMs(env: NodeJS.ProcessEnv = process.env): number {
    return Math.max(0, readNumber('FLAGS_CACHE_SECONDS', 15, env)) * 1000;
}

/**
 * How long one flag evaluation may take before the declared default is served instead (`FLAGS_TIMEOUT_MS`, default
 * 1000). A slow or unreachable provider must cost a request at most this, never fail it.
 */
export function readFlagsTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
    return Math.max(1, readNumber('FLAGS_TIMEOUT_MS', 1000, env));
}

/**
 * The workspace whose owners and admins operate the flags of the own provider (`FLAGS_ADMIN_WORKSPACE_ID`): flags
 * are global to the deployment, so the owner of any other workspace (any customer) must not be able to flip them.
 * Unset means nobody (the admin routes answer `403`). `*` means any workspace, and is honored only in `local`, where
 * it makes the emulators and the browser tests easy; elsewhere it counts as unset.
 */
export function canOperateFlagsFrom(
    workspaceId: string,
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    const configured = env.FLAGS_ADMIN_WORKSPACE_ID?.trim();
    if (!configured) return false;
    if (configured === '*') return readEnvironment(env) === 'local';
    return configured === workspaceId;
}

/** The LaunchDarkly server-side SDK key: a secret (Secret Manager), needed only with `FLAGS_PROVIDER=launchdarkly`. */
export function readLaunchDarklySdkKey(env: NodeJS.ProcessEnv = process.env): string {
    const key = env.LAUNCHDARKLY_SDK_KEY?.trim();
    if (!key) {
        throw new Error(
            'FLAGS_PROVIDER=launchdarkly needs LAUNCHDARKLY_SDK_KEY (a Secret Manager secret, docs/FLAGS.md).',
        );
    }
    return key;
}

/** The local server's port. Deployed, Cloud Functions decides. */
export function readPort(env: NodeJS.ProcessEnv = process.env): number {
    return readNumber('PORT', 3100, env);
}

/**
 * Refuses to start a deployed environment against the emulators, or a local one against a real project without
 * saying so: both are the kind of mistake you find out about from the data.
 */
export function assertSafeEnvironment(env: NodeJS.ProcessEnv = process.env): void {
    if (readEnvironment(env) !== 'local' && usesEmulators(env)) {
        throw new Error(
            `APP_ENVIRONMENT=${readEnvironment(env)} cannot run against the emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set).`,
        );
    }
}
