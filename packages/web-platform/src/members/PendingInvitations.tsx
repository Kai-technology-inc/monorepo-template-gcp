'use client';

import { useState, type ReactNode } from 'react';
import { apiRoutes, type Invitation } from '@app/contracts';
import { useFormatters, useT } from '@app/i18n/react';
import { Alert, Button, callApi, Card, EmptyState, Table, useErrorMessage } from '@app/web-kit';

export function PendingInvitations({
    workspaceId,
    invitations,
    onChanged,
}: {
    readonly workspaceId: string;
    readonly invitations: readonly Invitation[];
    readonly onChanged: () => void;
}): ReactNode {
    const t = useT();
    const format = useFormatters();
    const errorMessage = useErrorMessage();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    return (
        <Card title={t('members.pending.title')}>
            {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
            {invitations.length === 0 ? (
                <EmptyState>{t('members.pending.empty')}</EmptyState>
            ) : (
                <Table
                    caption={t('members.pending.title')}
                    columns={[
                        { key: 'email', label: t('members.columns.email') },
                        { key: 'role', label: t('members.columns.role') },
                        { key: 'expires', label: t('members.columns.expires') },
                        { key: 'actions', label: t('members.columns.actions'), hidden: true },
                    ]}
                >
                    {invitations.map((invitation) => (
                        <tr key={invitation.id}>
                            <td>{invitation.email}</td>
                            <td>{t(`roles.${invitation.role}`)}</td>
                            <td>
                                {t('members.pending.expires', {
                                    date: format.date(invitation.expiresAt),
                                })}
                            </td>
                            <td>
                                <Button
                                    variant="ghost"
                                    busy={busyId === invitation.id}
                                    onClick={async () => {
                                        setBusyId(invitation.id);
                                        setNotice(null);
                                        try {
                                            await callApi(
                                                apiRoutes.workspaces.invitation(
                                                    workspaceId,
                                                    invitation.id,
                                                ),
                                                { method: 'DELETE' },
                                            );
                                            setNotice({
                                                tone: 'success',
                                                text: t('members.pending.revoked'),
                                            });
                                            onChanged();
                                        } catch (caught) {
                                            setNotice({
                                                tone: 'error',
                                                text: errorMessage(caught),
                                            });
                                        } finally {
                                            setBusyId(null);
                                        }
                                    }}
                                >
                                    {t('members.pending.revoke')}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
        </Card>
    );
}
