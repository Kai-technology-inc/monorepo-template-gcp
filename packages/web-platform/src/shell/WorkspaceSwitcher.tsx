'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useT } from '@app/i18n/react';
import { DEFAULT_SIGNED_IN_ROUTE, InlineSelect, useAuth } from '@app/web-kit';

export function WorkspaceSwitcher(): ReactNode {
    const t = useT();
    const router = useRouter();
    const { session, switchWorkspace } = useAuth();
    const [busy, setBusy] = useState(false);
    if (!session?.workspace || session.memberships.length === 0) return null;

    return (
        <InlineSelect
            label={t('workspace.switcher')}
            value={session.workspace.id}
            disabled={busy || session.memberships.length < 2}
            options={session.memberships.map((membership) => ({
                value: membership.workspaceId,
                label: membership.name,
            }))}
            onChange={async (event) => {
                setBusy(true);
                try {
                    await switchWorkspace(event.target.value);
                    router.push(DEFAULT_SIGNED_IN_ROUTE);
                } finally {
                    setBusy(false);
                }
            }}
        />
    );
}
