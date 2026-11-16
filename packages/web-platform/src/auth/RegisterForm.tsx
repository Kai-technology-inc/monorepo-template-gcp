'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RichText, useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    Loading,
    ROUTES,
    safeNextPath,
    TextField,
    useAuth,
    useErrorMessage,
    withNext,
} from '@app/web-kit';
import { AuthHeading } from './AuthShell';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Three ways in:
 * - **New account**: name, email, password and the first workspace.
 * - **From an invitation** (`?email=` is set by the accept screen): the email is fixed and there is no workspace
 *   to create; accepting the invitation gives one.
 * - **Finishing** (`status === 'unregistered'`): Firebase has the identity but the profile was never created, so only
 *   the profile fields are asked.
 */
export function RegisterForm(): ReactNode {
    const t = useT();
    const router = useRouter();
    const params = useSearchParams();
    const next = params.get('next');
    const invitedEmail = params.get('email');
    const { status, user, register, completeRegistration } = useAuth();
    const errorMessage = useErrorMessage();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState(invitedEmail ?? '');
    const [password, setPassword] = useState('');
    const [workspaceName, setWorkspaceName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'ready') router.replace(safeNextPath(next));
    }, [status, next, router]);

    if (status === 'loading' || status === 'ready') return <Loading label={t('common.loading')} />;

    const completing = status === 'unregistered';
    const fromInvitation = !!invitedEmail;
    const passwordTooShort =
        !completing && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

    return (
        <form
            className="ui-stack"
            noValidate
            onSubmit={async (event) => {
                event.preventDefault();
                if (!completing && password.length < MIN_PASSWORD_LENGTH) {
                    setError(t('auth.errors.weakPassword'));
                    return;
                }
                setBusy(true);
                setError(null);
                const workspace = fromInvitation ? undefined : workspaceName.trim() || undefined;
                try {
                    if (completing) {
                        await completeRegistration({
                            displayName: displayName.trim(),
                            workspaceName: workspace,
                        });
                    } else {
                        await register({
                            displayName: displayName.trim(),
                            email: email.trim(),
                            password,
                            workspaceName: workspace,
                        });
                    }
                } catch (caught) {
                    setError(errorMessage(caught));
                    setBusy(false);
                }
            }}
        >
            {completing ? (
                <AuthHeading
                    title={t('auth.register.completeTitle')}
                    subtitle={t('auth.register.completeSubtitle', { email: user?.email ?? '' })}
                />
            ) : (
                <AuthHeading
                    title={t('auth.register.title')}
                    subtitle={t('auth.register.subtitle')}
                />
            )}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <TextField
                label={t('auth.register.displayName')}
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
            />
            {completing ? null : (
                <>
                    <TextField
                        label={t('common.email')}
                        type="email"
                        autoComplete="email"
                        required
                        readOnly={fromInvitation}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                    <TextField
                        label={t('common.password')}
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        hint={t('auth.register.passwordHint')}
                        error={passwordTooShort ? t('auth.errors.weakPassword') : null}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </>
            )}
            {fromInvitation ? null : (
                <TextField
                    label={t('auth.register.workspaceName')}
                    hint={t('auth.register.workspaceHint')}
                    required
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                />
            )}
            <Button type="submit" block busy={busy}>
                {busy ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
            {completing ? null : (
                <p className="auth-footer">
                    <RichText
                        k="auth.register.haveAccount"
                        tags={{
                            link: (chunk) => (
                                <Link href={withNext(ROUTES.login, next)}>{chunk}</Link>
                            ),
                        }}
                    />
                </p>
            )}
        </form>
    );
}
