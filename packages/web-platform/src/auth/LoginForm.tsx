'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RichText, useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    ROUTES,
    safeNextPath,
    TextField,
    useAuth,
    useErrorMessage,
    withNext,
} from '@app/web-kit';
import { AuthHeading } from './AuthShell';

export function LoginForm(): ReactNode {
    const t = useT();
    const router = useRouter();
    const next = useSearchParams().get('next');
    const { status, signIn } = useAuth();
    const errorMessage = useErrorMessage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'ready') router.replace(safeNextPath(next));
        if (status === 'unregistered')
            router.replace(withNext(ROUTES.register, safeNextPath(next)));
    }, [status, next, router]);

    return (
        <form
            className="ui-stack"
            noValidate
            onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError(null);
                try {
                    await signIn(email.trim(), password);
                } catch (caught) {
                    setError(errorMessage(caught));
                    setBusy(false);
                }
            }}
        >
            <AuthHeading title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
            {error ? <Alert tone="error">{error}</Alert> : null}
            <TextField
                label={t('common.email')}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
                label={t('common.password')}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" block busy={busy}>
                {busy ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
            <Link href={withNext(ROUTES.forgotPassword, next)} className="muted">
                {t('auth.login.forgotPassword')}
            </Link>
            <p className="auth-footer">
                <RichText
                    k="auth.login.noAccount"
                    tags={{
                        link: (chunk) => (
                            <Link href={withNext(ROUTES.register, next)}>{chunk}</Link>
                        ),
                    }}
                />
            </p>
        </form>
    );
}
