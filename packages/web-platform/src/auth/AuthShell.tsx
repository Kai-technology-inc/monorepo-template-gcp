'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '@app/i18n/react';
import { Card, LocaleSwitcher, ROUTES } from '@app/web-kit';

/** The frame of every `/auth/*` page: brand, language picker and a centered card. */
export function AuthShell({ children }: { readonly children: ReactNode }): ReactNode {
    const t = useT();
    return (
        <div className="auth-shell">
            <div className="auth-shell__top">
                <Link href={ROUTES.home} className="brand">
                    {t('common.appName')}
                </Link>
                <LocaleSwitcher />
            </div>
            <main className="auth-shell__card">
                <Card as="div">{children}</Card>
            </main>
        </div>
    );
}

export function AuthHeading({
    title,
    subtitle,
}: {
    readonly title: string;
    readonly subtitle?: string;
}): ReactNode {
    return (
        <>
            <h1 className="auth-title">{title}</h1>
            {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </>
    );
}
