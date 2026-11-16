'use client';

import { useState, type ReactNode } from 'react';
import {
    apiRoutes,
    InvitationListResponseSchema,
    MemberSchema,
    type Member,
    type WorkspaceRole,
} from '@app/contracts';
import { useFormatters, useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    callApi,
    Card,
    ConfirmDialog,
    InlineSelect,
    Loading,
    Table,
    useApiQuery,
    useAuth,
    useErrorMessage,
} from '@app/web-kit';
import {
    assignableRoles,
    canChangeRole,
    canRemove,
    sortMembers,
    type Actor,
} from '../lib/member-rules';
import { useMembers } from '../lib/use-members';
import { InviteForm } from './InviteForm';
import { PendingInvitations } from './PendingInvitations';

export function MembersScreen(): ReactNode {
    const t = useT();
    const format = useFormatters();
    const { session, can } = useAuth();
    const errorMessage = useErrorMessage();
    const workspace = session?.workspace ?? null;
    const { members, error, reload } = useMembers(workspace?.id ?? null);
    const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [busyUserId, setBusyUserId] = useState<string | null>(null);
    const [removing, setRemoving] = useState<Member | null>(null);
    const managesInvitations = can('invitations:manage');

    const invitationsPath =
        workspace && managesInvitations ? apiRoutes.workspaces.invitations(workspace.id) : null;
    const invitationsQuery = useApiQuery(invitationsPath, async (signal) => {
        const response = await callApi(invitationsPath as string, {
            schema: InvitationListResponseSchema,
            signal,
        });
        return response.invitations;
    });
    const reloadInvitations = invitationsQuery.reload;

    if (!session || !workspace) return null;
    const actor: Actor = {
        userId: session.user.id,
        role: session.role,
        permissions: session.permissions,
    };

    const changeRole = async (member: Member, role: WorkspaceRole) => {
        setBusyUserId(member.userId);
        setNotice(null);
        try {
            await callApi(apiRoutes.workspaces.member(workspace.id, member.userId), {
                method: 'PATCH',
                body: { role },
                schema: MemberSchema,
            });
            setNotice({ tone: 'success', text: t('common.saved') });
            reload();
        } catch (caught) {
            setNotice({ tone: 'error', text: errorMessage(caught) });
        } finally {
            setBusyUserId(null);
        }
    };

    const remove = async (member: Member) => {
        setBusyUserId(member.userId);
        setNotice(null);
        try {
            await callApi(apiRoutes.workspaces.member(workspace.id, member.userId), {
                method: 'DELETE',
            });
            setNotice({
                tone: 'success',
                text: t('members.removed', { name: member.displayName }),
            });
            setRemoving(null);
            reload();
        } catch (caught) {
            setNotice({ tone: 'error', text: errorMessage(caught) });
            setRemoving(null);
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <div className="ui-stack">
            <div>
                <h1 className="page-title">{t('members.title')}</h1>
                <p className="page-subtitle">
                    {t('members.subtitle', { workspace: workspace.name })}
                </p>
            </div>
            {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
            <Card title={members ? t('members.count', { count: members.length }) : undefined}>
                {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
                {!members && !error ? <Loading label={t('common.loading')} /> : null}
                {members ? (
                    <Table
                        caption={t('members.title')}
                        columns={[
                            { key: 'name', label: t('members.columns.name') },
                            { key: 'email', label: t('members.columns.email') },
                            { key: 'role', label: t('members.columns.role') },
                            { key: 'joined', label: t('members.columns.joined') },
                            { key: 'actions', label: t('members.columns.actions'), hidden: true },
                        ]}
                    >
                        {sortMembers(members).map((member) => (
                            <tr key={member.userId}>
                                <td>
                                    {member.displayName}
                                    {member.userId === actor.userId
                                        ? ` (${t('common.you')})`
                                        : null}
                                </td>
                                <td>{member.email}</td>
                                <td>
                                    {canChangeRole(actor, member) ? (
                                        <InlineSelect
                                            label={t('members.changeRole', {
                                                name: member.displayName,
                                            })}
                                            value={member.role}
                                            disabled={busyUserId === member.userId}
                                            options={assignableRoles(actor.role).map((role) => ({
                                                value: role,
                                                label: t(`roles.${role}`),
                                            }))}
                                            onChange={(event) =>
                                                void changeRole(
                                                    member,
                                                    event.target.value as WorkspaceRole,
                                                )
                                            }
                                        />
                                    ) : (
                                        t(`roles.${member.role}`)
                                    )}
                                </td>
                                <td>{format.date(member.joinedAt)}</td>
                                <td>
                                    {canRemove(actor, member) ? (
                                        <Button
                                            variant="ghost"
                                            disabled={busyUserId === member.userId}
                                            onClick={() => setRemoving(member)}
                                        >
                                            {t('members.remove')}
                                        </Button>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </Table>
                ) : null}
            </Card>
            {managesInvitations ? (
                <>
                    <InviteForm workspaceId={workspace.id} onCreated={reloadInvitations} />
                    {invitationsQuery.error ? (
                        <Alert tone="error">{errorMessage(invitationsQuery.error)}</Alert>
                    ) : null}
                    <PendingInvitations
                        workspaceId={workspace.id}
                        invitations={invitationsQuery.data ?? []}
                        onChanged={reloadInvitations}
                    />
                </>
            ) : null}
            <ConfirmDialog
                open={removing !== null}
                title={t('members.removeTitle')}
                confirmLabel={t('members.remove')}
                cancelLabel={t('common.cancel')}
                destructive
                busy={removing !== null && busyUserId === removing.userId}
                onCancel={() => setRemoving(null)}
                onConfirm={() => removing && void remove(removing)}
            >
                <p>
                    {removing ? t('members.removeConfirm', { name: removing.displayName }) : null}
                </p>
            </ConfirmDialog>
        </div>
    );
}
