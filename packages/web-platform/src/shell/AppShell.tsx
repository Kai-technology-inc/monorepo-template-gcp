'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { useT } from '@app/i18n/react';
import type { MessageKey } from '@app/i18n';
import { Button, Loading, LocaleSwitcher, ROUTES, useAuth } from '@app/web-kit';
import { AuthGate } from './AuthGate';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/**
 * The navigation. Add a module's entry here (and its route in `apps/web/src/app/(app)`); the label is a dictionary
 * key, never text.
 */
const NAV: readonly {
    readonly href: string;
    readonly label: Extract<MessageKey, `nav.${string}`>;
}[] = [
    { href: ROUTES.dashboard, label: 'nav.dashboard' },
    { href: ROUTES.members, label: 'nav.members' },
    { href: ROUTES.settings, label: 'nav.settings' },
];

export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
    const t = useT();
    return (
        <Suspense fallback={<Loading label={t('common.loading')} />}>
            <AuthGate>
                <ShellFrame>{children}</ShellFrame>
            </AuthGate>
        </Suspense>
    );
}

function ShellFrame({ children }: { readonly children: ReactNode }): ReactNode {
    const t = useT();
    const pathname = usePathname();
    const { session, signOut } = useAuth();

    return (
        <div className="app-shell">
            <a href="#main" className="skip-link">
                {t('nav.skipToContent')}
            </a>
            <header className="app-shell__header">
                <Link href={ROUTES.dashboard} className="brand">
                    {t('common.appName')}
                </Link>
                <WorkspaceSwitcher />
                <span className="app-shell__spacer" />
                <LocaleSwitcher />
                <span className="app-shell__user">{session?.user.email}</span>
                <Button variant="ghost" onClick={() => void signOut()}>
                    {t('common.signOut')}
                </Button>
            </header>
            <nav className="app-shell__nav" aria-label={t('nav.main')}>
                <ul>
                    {NAV.map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                            >
                                {t(item.label)}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            <main id="main" className="app-shell__main">
                {children}
            </main>
        </div>
    );
}
