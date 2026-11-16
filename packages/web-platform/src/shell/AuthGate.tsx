'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useT } from '@app/i18n/react';
import { Alert, Button, Loading, useAuth, useErrorMessage } from '@app/web-kit';
import { gateDecision } from '../lib/gate';

/** Renders its children only when `gateDecision` says so; otherwise waits, redirects or offers a retry. */
export function AuthGate({ children }: { readonly children: ReactNode }): ReactNode {
    const t = useT();
    const router = useRouter();
    const pathname = usePathname();
    const query = useSearchParams().toString();
    const { status, session, error, refreshSession } = useAuth();
    const errorMessage = useErrorMessage();
    const decision = gateDecision(status, session, query ? `${pathname}?${query}` : pathname);

    useEffect(() => {
        if (decision.kind === 'redirect') router.replace(decision.to);
    }, [decision, router]);

    if (decision.kind === 'render') return children;
    if (decision.kind === 'error') {
        return (
            <div className="ui-stack" style={{ maxWidth: '28rem', margin: '4rem auto' }}>
                <Alert tone="error">{errorMessage(error)}</Alert>
                <Button variant="secondary" onClick={() => void refreshSession()}>
                    {t('common.retry')}
                </Button>
            </div>
        );
    }
    return <Loading label={t('common.loading')} />;
}
