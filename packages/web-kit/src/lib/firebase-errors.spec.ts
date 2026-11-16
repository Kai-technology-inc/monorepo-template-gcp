import { describe, expect, it } from 'vitest';
import { firebaseErrorKey } from './firebase-errors';

describe('firebaseErrorKey', () => {
    it('does not reveal whether an account exists', () => {
        expect(firebaseErrorKey({ code: 'auth/user-not-found' })).toBe(
            'auth.errors.invalidCredential',
        );
        expect(firebaseErrorKey({ code: 'auth/wrong-password' })).toBe(
            'auth.errors.invalidCredential',
        );
    });

    it('maps known codes', () => {
        expect(firebaseErrorKey({ code: 'auth/email-already-in-use' })).toBe(
            'auth.errors.emailInUse',
        );
        expect(firebaseErrorKey({ code: 'auth/too-many-requests' })).toBe(
            'auth.errors.tooManyRequests',
        );
    });

    it('falls back to the generic message', () => {
        expect(firebaseErrorKey({ code: 'auth/something-new' })).toBe('auth.errors.generic');
        expect(firebaseErrorKey(new Error('boom'))).toBe('auth.errors.generic');
        expect(firebaseErrorKey(null)).toBe('auth.errors.generic');
    });
});
