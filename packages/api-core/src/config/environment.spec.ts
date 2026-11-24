import { describe, expect, it } from 'vitest';
import {
    assertSafeEnvironment,
    canOperateFlagsFrom,
    readAllowedOrigins,
    readEnvironment,
    readFlagsCacheMs,
    readFlagsProviderName,
    readFlagsTimeoutMs,
    readLaunchDarklySdkKey,
    readProjectId,
    requiresVerifiedEmail,
} from './environment';

describe('environment', () => {
    it('defaults to local and ignores unknown values', () => {
        expect(readEnvironment({})).toBe('local');
        expect(readEnvironment({ APP_ENVIRONMENT: 'staging' })).toBe('local');
        expect(readEnvironment({ APP_ENVIRONMENT: 'PROD' })).toBe('prod');
    });

    it('parses the allowed origins and drops trailing slashes', () => {
        expect(
            readAllowedOrigins({ ALLOWED_ORIGINS: ' https://a.com/, http://localhost:3000 ,' }),
        ).toEqual(['https://a.com', 'http://localhost:3000']);
        expect(readAllowedOrigins({})).toEqual([]);
    });

    it('requires verified emails outside local unless told otherwise', () => {
        expect(requiresVerifiedEmail({})).toBe(false);
        expect(requiresVerifiedEmail({ APP_ENVIRONMENT: 'qa' })).toBe(true);
        expect(
            requiresVerifiedEmail({ APP_ENVIRONMENT: 'qa', AUTH_REQUIRE_VERIFIED_EMAIL: 'false' }),
        ).toBe(false);
        expect(requiresVerifiedEmail({ AUTH_REQUIRE_VERIFIED_EMAIL: 'true' })).toBe(true);
    });

    it('reads the project id from the runtime or FIREBASE_CONFIG', () => {
        expect(readProjectId({ GCLOUD_PROJECT: 'p1' })).toBe('p1');
        expect(readProjectId({ FIREBASE_CONFIG: '{"projectId":"p2"}' })).toBe('p2');
        expect(readProjectId({ FIREBASE_CONFIG: 'nope' })).toBeUndefined();
    });

    it('refuses a deployed environment pointed at the emulators', () => {
        expect(() =>
            assertSafeEnvironment({
                APP_ENVIRONMENT: 'prod',
                FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
            }),
        ).toThrow(/emulators/);
        expect(() =>
            assertSafeEnvironment({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }),
        ).not.toThrow();
    });

    it('evaluates flags with Firestore unless told otherwise', () => {
        expect(readFlagsProviderName({})).toBe('firestore');
        expect(readFlagsProviderName({ FLAGS_PROVIDER: ' LaunchDarkly ' })).toBe('launchdarkly');
    });

    it('reads the flags cache and timeout with sane floors', () => {
        expect(readFlagsCacheMs({})).toBe(15_000);
        expect(readFlagsCacheMs({ FLAGS_CACHE_SECONDS: '0' })).toBe(0);
        expect(readFlagsCacheMs({ FLAGS_CACHE_SECONDS: '-5' })).toBe(0);
        expect(readFlagsTimeoutMs({})).toBe(1000);
        expect(readFlagsTimeoutMs({ FLAGS_TIMEOUT_MS: '0' })).toBe(1);
    });

    it('lets only the configured workspace operate flags, and `*` only locally', () => {
        expect(canOperateFlagsFrom('w1', {})).toBe(false);
        expect(canOperateFlagsFrom('w1', { FLAGS_ADMIN_WORKSPACE_ID: 'w1' })).toBe(true);
        expect(canOperateFlagsFrom('w2', { FLAGS_ADMIN_WORKSPACE_ID: 'w1' })).toBe(false);
        expect(canOperateFlagsFrom('w2', { FLAGS_ADMIN_WORKSPACE_ID: '*' })).toBe(true);
        expect(
            canOperateFlagsFrom('w2', { FLAGS_ADMIN_WORKSPACE_ID: '*', APP_ENVIRONMENT: 'prod' }),
        ).toBe(false);
    });

    it('needs the LaunchDarkly key only when asked for it', () => {
        expect(() => readLaunchDarklySdkKey({})).toThrow(/LAUNCHDARKLY_SDK_KEY/);
        expect(readLaunchDarklySdkKey({ LAUNCHDARKLY_SDK_KEY: ' sdk-1 ' })).toBe('sdk-1');
    });
});
