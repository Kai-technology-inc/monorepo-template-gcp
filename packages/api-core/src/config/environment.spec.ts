import { describe, expect, it } from 'vitest';
import {
    assertSafeEnvironment,
    readAllowedOrigins,
    readEnvironment,
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
});
