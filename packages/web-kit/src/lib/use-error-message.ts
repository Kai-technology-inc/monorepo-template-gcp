'use client';

import { useCallback } from 'react';
import { useT } from '@app/i18n/react';
import { ApiError, errorMessageKey } from './api-error';
import { firebaseErrorCode, firebaseErrorKey } from './firebase-errors';

/**
 * `(error) => text` for anything a form can catch: an `ApiError` reads `errors.<CODE>`, a Firebase Auth error
 * reads `auth.errors.*`, anything else the generic message. Screens never print `error.message`.
 */
export function useErrorMessage(): (error: unknown) => string {
    const t = useT();
    return useCallback(
        (error: unknown) => {
            if (error instanceof ApiError) return t(errorMessageKey(error));
            if (firebaseErrorCode(error)) return t(firebaseErrorKey(error));
            return t('errors.unknown');
        },
        [t],
    );
}
