'use client';

import { useState, type ReactNode } from 'react';
import {
    apiRoutes,
    CreateInvitationResponseSchema,
    INVITATION_TTL_DAYS,
    type InvitableRole,
} from '@app/contracts';
import { useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    callApi,
    Card,
    SelectField,
    TextField,
    useErrorMessage,
} from '@app/web-kit';

const INVITABLE: readonly InvitableRole[] = ['MEMBER', 'ADMIN'];

/**
 * Creates an invitation and shows its link. The template sends no email: the person who invites shares the link
 * (see docs/EXTENDING.md to plug an email provider into the API).
 */
export function InviteForm({
    workspaceId,
    onCreated,
}: {
    readonly workspaceId: string;
    readonly onCreated: () => void;
}): ReactNode {
    const t = useT();
    const errorMessage = useErrorMessage();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<InvitableRole>('MEMBER');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
    const [copied, setCopied] = useState(false);

    return (
        <Card title={t('members.invite.title')}>
            <form
                className="ui-stack"
                noValidate
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError(null);
                    setCopied(false);
                    try {
                        const response = await callApi(
                            apiRoutes.workspaces.invitations(workspaceId),
                            {
                                method: 'POST',
                                body: { email: email.trim(), role },
                                schema: CreateInvitationResponseSchema,
                            },
                        );
                        setCreated({
                            email: response.invitation.email,
                            link: `${window.location.origin}${response.acceptPath}`,
                        });
                        setEmail('');
                        onCreated();
                    } catch (caught) {
                        setError(errorMessage(caught));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {error ? <Alert tone="error">{error}</Alert> : null}
                <div className="ui-row">
                    <TextField
                        label={t('members.invite.email')}
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                    <SelectField
                        label={t('members.invite.role')}
                        value={role}
                        options={INVITABLE.map((value) => ({ value, label: t(`roles.${value}`) }))}
                        onChange={(event) => setRole(event.target.value as InvitableRole)}
                    />
                </div>
                <div>
                    <Button type="submit" busy={busy}>
                        {busy ? t('members.invite.submitting') : t('members.invite.submit')}
                    </Button>
                </div>
                {created ? (
                    <Alert tone="success">
                        <p>{t('members.invite.created', { email: created.email })}</p>
                        <div className="invite-link">
                            <input
                                className="ui-input"
                                readOnly
                                aria-label={t('members.invite.linkLabel')}
                                value={created.link}
                                onFocus={(event) => event.target.select()}
                            />
                            <Button
                                variant="secondary"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(created.link);
                                    setCopied(true);
                                }}
                            >
                                {copied ? t('common.copied') : t('common.copy')}
                            </Button>
                        </div>
                        <p className="muted">
                            {t('members.invite.linkHint', { days: INVITATION_TTL_DAYS })}
                        </p>
                    </Alert>
                ) : null}
            </form>
        </Card>
    );
}
