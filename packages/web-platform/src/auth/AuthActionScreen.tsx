'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    ButtonLink,
    DEFAULT_SIGNED_IN_ROUTE,
    firebaseAuth,
    Loading,
    ROUTES,
    TextField,
    useAuth,
    useErrorMessage,
} from '@app/web-kit';
import { AuthHeading } from './AuthShell';

/**
 * THE LANDING PAGE OF FIREBASE'S EMAIL LINKS
 *
 * Point the Auth email templates' action URL here (Firebase console → Authentication → Templates →
 * "Customize action URL": `https://<your-domain>/auth/action`). Firebase appends `mode` and `oobCode`.
 */
export function AuthActionScreen(): ReactNode {
    const params = useSearchParams();
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) return <ResetPasswordForm code={code} />;
    if (mode === 'verifyEmail' && code) return <VerifyEmailAction code={code} />;
    return <InvalidLink />;
}

function InvalidLink(): ReactNode {
    const t = useT();
    return (
        <div className="ui-stack">
            <Alert tone="error">{t('auth.action.invalid')}</Alert>
            <ButtonLink href={ROUTES.login} variant="secondary">
                {t('auth.reset.goToLogin')}
            </ButtonLink>
        </div>
    );
}

function VerifyEmailAction({ code }: { readonly code: string }): ReactNode {
    const t = useT();
    const { refreshSession } = useAuth();
    const [state, setState] = useState<'working' | 'done' | 'invalid'>('working');
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        applyActionCode(firebaseAuth(), code)
            .then(async () => {
                setState('done');
                const user = firebaseAuth().currentUser;
                if (user) {
                    await user.reload();
                    await refreshSession({ forceToken: true });
                }
            })
            .catch(() => setState('invalid'));
    }, [code, refreshSession]);

    if (state === 'working') return <Loading label={t('auth.action.processing')} />;
    if (state === 'invalid') return <InvalidLink />;
    return (
        <div className="ui-stack">
            <AuthHeading title={t('auth.verify.title')} />
            <Alert tone="success">{t('auth.verify.verified')}</Alert>
            <ButtonLink href={DEFAULT_SIGNED_IN_ROUTE}>{t('common.continue')}</ButtonLink>
        </div>
    );
}

export function ResetPasswordForm({ code }: { readonly code: string }): ReactNode {
    const t = useT();
    const errorMessage = useErrorMessage();
    const [state, setState] = useState<'checking' | 'form' | 'done' | 'invalid'>('checking');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        verifyPasswordResetCode(firebaseAuth(), code)
            .then(() => setState('form'))
            .catch(() => setState('invalid'));
    }, [code]);

    if (state === 'checking') return <Loading label={t('auth.action.processing')} />;
    if (state === 'invalid') return <InvalidLink />;
    if (state === 'done') {
        return (
            <div className="ui-stack">
                <Alert tone="success">{t('auth.reset.done')}</Alert>
                <ButtonLink href={ROUTES.login}>{t('auth.reset.goToLogin')}</ButtonLink>
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
                try {
                    await confirmPasswordReset(firebaseAuth(), code, password);
                    setState('done');
                } catch (caught) {
                    setError(errorMessage(caught));
                } finally {
                    setBusy(false);
                }
            }}
        >
            <AuthHeading title={t('auth.reset.title')} />
            {error ? <Alert tone="error">{error}</Alert> : null}
            <TextField
                label={t('auth.reset.newPassword')}
                type="password"
                autoComplete="new-password"
                hint={t('auth.register.passwordHint')}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" block busy={busy}>
                {busy ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </Button>
        </form>
    );
}
