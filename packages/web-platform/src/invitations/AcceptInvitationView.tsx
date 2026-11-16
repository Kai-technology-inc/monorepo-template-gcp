'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { InvitationPreview } from '@app/contracts';
import { RichText, useT } from '@app/i18n/react';
import { Alert, Button, ButtonLink, Loading, ROUTES } from '@app/web-kit';
import type { AcceptState } from '../lib/accept-invitation';
import { AuthHeading } from '../auth/AuthShell';

export interface AcceptInvitationViewProps {
    readonly state: AcceptState;
    readonly preview: InvitationPreview | null;
    readonly signedInEmail: string | null;
    readonly loginHref: string;
    readonly registerHref: string;
    readonly verifyHref: string;
    readonly busy: boolean;
    readonly error: string | null;
    readonly onAccept: () => void;
    readonly onSwitchAccount: () => void;
    readonly onRetry: () => void;
}

/** Pure: what the accept screen says in each state. `AcceptInvitationScreen` wires it to the API and the session. */
export function AcceptInvitationView(props: AcceptInvitationViewProps): ReactNode {
    const t = useT();
    const { state, preview } = props;

    if (state === 'loading') return <Loading label={t('common.loading')} />;
    if (state === 'invalid' || state === 'expired') {
        return (
            <div className="ui-stack">
                <Alert tone="error">
                    {state === 'expired'
                        ? t('errors.INVITATION_EXPIRED')
                        : t('invitations.accept.invalid')}
                </Alert>
                <ButtonLink href={ROUTES.home} variant="secondary">
                    {t('notFound.home')}
                </ButtonLink>
            </div>
        );
    }
    if (state === 'error' || !preview) {
        return (
            <div className="ui-stack">
                <Alert tone="error">{props.error ?? t('errors.unknown')}</Alert>
                <Button variant="secondary" onClick={props.onRetry}>
                    {t('common.retry')}
                </Button>
            </div>
        );
    }

    const role = t(`roles.${preview.role}`);
    const heading = (
        <AuthHeading
            title={t('invitations.accept.title', { workspace: preview.workspaceName })}
            subtitle={t('invitations.accept.body', { email: preview.email, role })}
        />
    );

    switch (state) {
        case 'signed-out':
        case 'needs-registration':
            return (
                <div className="ui-stack">
                    {heading}
                    {state === 'signed-out' ? (
                        <>
                            <p>
                                {t('invitations.accept.signInToAccept', { email: preview.email })}
                            </p>
                            <ButtonLink href={props.loginHref} block>
                                {t('invitations.accept.signIn')}
                            </ButtonLink>
                        </>
                    ) : null}
                    <p className="auth-footer">
                        <RichText
                            k="invitations.accept.registerToAccept"
                            params={{ email: preview.email }}
                            tags={{
                                link: (chunk) => <Link href={props.registerHref}>{chunk}</Link>,
                            }}
                        />
                    </p>
                </div>
            );
        case 'needs-verification':
            return (
                <div className="ui-stack">
                    {heading}
                    <Alert tone="info">{t('errors.EMAIL_NOT_VERIFIED')}</Alert>
                    <ButtonLink href={props.verifyHref} block>
                        {t('common.continue')}
                    </ButtonLink>
                </div>
            );
        case 'wrong-account':
            return (
                <div className="ui-stack">
                    {heading}
                    <Alert tone="error">
                        {t('invitations.accept.wrongAccount', {
                            current: props.signedInEmail ?? '',
                            email: preview.email,
                        })}
                    </Alert>
                    <Button variant="secondary" block onClick={props.onSwitchAccount}>
                        {t('invitations.accept.switchAccount')}
                    </Button>
                </div>
            );
        case 'ready':
            return (
                <div className="ui-stack">
                    {heading}
                    {props.error ? <Alert tone="error">{props.error}</Alert> : null}
                    <Button block busy={props.busy} onClick={props.onAccept}>
                        {props.busy
                            ? t('invitations.accept.submitting')
                            : t('invitations.accept.submit')}
                    </Button>
                </div>
            );
    }
}
