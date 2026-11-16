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
