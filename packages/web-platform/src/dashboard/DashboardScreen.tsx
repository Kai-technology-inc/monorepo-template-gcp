'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText, useT } from '@app/i18n/react';
import { Card, ROUTES, useAuth, useFlag } from '@app/web-kit';
import { useMembers } from '../lib/use-members';

export function DashboardScreen(): ReactNode {
    const t = useT();
    const { session, can } = useAuth();
    const workspace = session?.workspace ?? null;
    const { members } = useMembers(workspace && can('members:read') ? workspace.id : null);
    // The template's example of a change released behind a flag (docs/FLAGS.md): off until someone turns it on.
    const whatsNew = useFlag('dashboard-whats-new');
    if (!session || !workspace || !session.role) return null;

    return (
        <div className="ui-stack">
            <div>
                <h1 className="page-title">
                    {t('dashboard.welcome', { name: session.user.displayName })}
                </h1>
                <p className="page-subtitle">
                    {t('dashboard.workspaceSummary', {
                        workspace: workspace.name,
                        role: t(`roles.${session.role}`),
                    })}
                </p>
            </div>
            {whatsNew ? (
                <Card title={t('dashboard.whatsNew.title')}>
                    <p className="muted">{t('dashboard.whatsNew.body')}</p>
                </Card>
            ) : null}
            <Card title={workspace.name}>
                <p className="muted">
                    {members
                        ? t('dashboard.memberCount', { count: members.length })
                        : t('common.loading')}
                </p>
            </Card>
            <Card title={t('dashboard.nextSteps.title')}>
                <ol className="steps">
                    <li>
                        <RichText
                            k="dashboard.nextSteps.invite"
                            tags={{ link: (chunk) => <Link href={ROUTES.members}>{chunk}</Link> }}
                        />
                    </li>
                    <li>
                        <RichText
                            k="dashboard.nextSteps.language"
                            tags={{ link: (chunk) => <Link href={ROUTES.settings}>{chunk}</Link> }}
                        />
                    </li>
                    <li>{t('dashboard.nextSteps.build')}</li>
                </ol>
            </Card>
        </div>
    );
}
