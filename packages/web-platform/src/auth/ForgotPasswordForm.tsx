'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    firebaseAuth,
    firebaseErrorCode,
    ROUTES,
    TextField,
    useErrorMessage,
    withNext,
} from '@app/web-kit';
import { AuthHeading } from './AuthShell';

export function ForgotPasswordForm(): ReactNode {
    const t = useT();
    const next = useSearchParams().get('next');
    const errorMessage = useErrorMessage();
    const [email, setEmail] = useState('');
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const back = (
        <Link href={withNext(ROUTES.login, next)} className="muted">
            {t('auth.forgot.backToLogin')}
        </Link>
    );

    if (sentTo) {
        return (
            <div className="ui-stack">
                <AuthHeading title={t('auth.forgot.sentTitle')} />
                <Alert tone="success">{t('auth.forgot.sentBody', { email: sentTo })}</Alert>
                {back}
            </div>
        );
    }

    return (
        <form
            className="ui-stack"
            noValidate
            onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError(null);
                const address = email.trim();
                try {
                    await sendPasswordResetEmail(firebaseAuth(), address);
                    setSentTo(address);
                } catch (caught) {
                    // Do not reveal whether the account exists: an unknown email reads like a success.
                    if (firebaseErrorCode(caught) === 'auth/user-not-found') setSentTo(address);
                    else setError(errorMessage(caught));
                } finally {
                    setBusy(false);
                }
            }}
        >
            <AuthHeading title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />
            {error ? <Alert tone="error">{error}</Alert> : null}
            <TextField
                label={t('common.email')}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" block busy={busy}>
                {busy ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
            </Button>
            {back}
        </form>
    );
}
