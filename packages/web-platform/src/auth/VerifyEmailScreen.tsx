'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    Loading,
    needsEmailVerification,
    ROUTES,
    safeNextPath,
    useAuth,
    useErrorMessage,
    withNext,
} from '@app/web-kit';
import { AuthHeading } from './AuthShell';

export function VerifyEmailScreen(): ReactNode {
    const t = useT();
    const router = useRouter();
    const next = useSearchParams().get('next');
    const { status, session, user, sendVerificationEmail, checkEmailVerified, signOut } = useAuth();
    const errorMessage = useErrorMessage();
    const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [busy, setBusy] = useState<'resend' | 'check' | null>(null);

    useEffect(() => {
        if (status === 'signed-out')
            router.replace(withNext(ROUTES.login, withNext(ROUTES.verifyEmail, next)));
        if (status === 'ready' && !needsEmailVerification(session))
            router.replace(safeNextPath(next));
    }, [status, session, next, router]);

    if (status !== 'ready' || !needsEmailVerification(session))
        return <Loading label={t('common.loading')} />;

    return (
        <div className="ui-stack">
            <AuthHeading
                title={t('auth.verify.title')}
                subtitle={t('auth.verify.body', {
                    email: session?.user.email ?? user?.email ?? '',
                })}
            />
            {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
            <Button
                busy={busy === 'check'}
                block
                onClick={async () => {
                    setBusy('check');
                    setNotice(null);
                    try {
                        await checkEmailVerified();
                    } catch (caught) {
                        setNotice({ tone: 'error', text: errorMessage(caught) });
                    } finally {
                        setBusy(null);
                    }
                }}
            >
                {t('auth.verify.checkAgain')}
            </Button>
            <Button
                variant="secondary"
                block
                busy={busy === 'resend'}
                onClick={async () => {
                    setBusy('resend');
                    setNotice(null);
                    try {
                        await sendVerificationEmail();
                        setNotice({ tone: 'success', text: t('auth.verify.resent') });
                    } catch (caught) {
                        setNotice({ tone: 'error', text: errorMessage(caught) });
                    } finally {
                        setBusy(null);
                    }
                }}
            >
                {t('auth.verify.resend')}
            </Button>
            <Button variant="ghost" block onClick={() => void signOut()}>
                {t('common.signOut')}
            </Button>
        </div>
    );
}
