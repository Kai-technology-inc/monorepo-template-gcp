import type { MessageKey } from '@app/i18n';

/**
 * FIREBASE AUTH ERRORS, IN THE PERSON'S LANGUAGE
 *
 * The client SDK throws `FirebaseError`s with codes like `auth/invalid-credential`. Screens never show the SDK's
 * English message: they look the code up here. Several codes deliberately map to the same message (a wrong
 * password and an unknown email both read "incorrect", so the form does not reveal which accounts exist).
 */
/** The `auth.errors.*` keys: none of them takes parameters, so any of them can be passed straight to `t()`. */
export type AuthErrorKey = Extract<MessageKey, `auth.errors.${string}`>;

const BY_CODE: Readonly<Record<string, AuthErrorKey>> = {
    'auth/invalid-credential': 'auth.errors.invalidCredential',
    'auth/invalid-login-credentials': 'auth.errors.invalidCredential',
    'auth/wrong-password': 'auth.errors.invalidCredential',
    'auth/user-not-found': 'auth.errors.invalidCredential',
    'auth/user-disabled': 'auth.errors.invalidCredential',
    'auth/email-already-in-use': 'auth.errors.emailInUse',
    'auth/weak-password': 'auth.errors.weakPassword',
    'auth/password-does-not-meet-requirements': 'auth.errors.weakPassword',
    'auth/invalid-email': 'auth.errors.invalidEmail',
    'auth/missing-email': 'auth.errors.invalidEmail',
    'auth/too-many-requests': 'auth.errors.tooManyRequests',
    'auth/network-request-failed': 'auth.errors.network',
    'auth/expired-action-code': 'auth.errors.expiredActionCode',
    'auth/invalid-action-code': 'auth.errors.expiredActionCode',
};

export function firebaseErrorCode(error: unknown): string | null {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code: unknown }).code;
        if (typeof code === 'string' && code.startsWith('auth/')) return code;
    }
    return null;
}

export function firebaseErrorKey(error: unknown): AuthErrorKey {
    const code = firebaseErrorCode(error);
    return (code && BY_CODE[code]) || 'auth.errors.generic';
}
