'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { apiRoutes, InvitationPreviewSchema } from '@app/contracts';
import {
    callApi,
    DEFAULT_SIGNED_IN_ROUTE,
    ROUTES,
    useApiQuery,
    useAuth,
    useErrorMessage,
    withNext,
} from '@app/web-kit';
import { acceptState, readAcceptParams } from '../lib/accept-invitation';
import { AcceptInvitationView } from './AcceptInvitationView';

/**
 * `/auth/invitations/accept?workspace=…&invitation=…&token=…`: shows the public preview, sends the person through
 * sign-in or registration with this same URL as `next`, and accepts.
 */
export function AcceptInvitationScreen(): ReactNode {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const params = useMemo(
        () => readAcceptParams(new URLSearchParams(search.toString())),
        [search],
    );
    const here = `${pathname}?${search.toString()}`;
    const { status, session, user, acceptInvitation, signOut } = useAuth();
    const errorMessage = useErrorMessage();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const previewPath = params
        ? `${apiRoutes.workspaces.invitationPreview(params.workspaceId, params.invitationId)}?token=${encodeURIComponent(params.token)}`
        : null;
    const previewQuery = useApiQuery(previewPath, (signal) =>
        callApi(previewPath as string, {
            anonymous: true,
            schema: InvitationPreviewSchema,
            signal,
        }),
    );
    const preview = previewQuery.data;
    const previewError = previewQuery.error;

    const state = acceptState({
        params,
        preview,
        previewError,
        status,
        session,
        signedInEmail: user?.email ?? null,
    });

    const accept = useCallback(async () => {
        if (!params) return;
        setBusy(true);
        setError(null);
        try {
            await acceptInvitation(params.workspaceId, params.invitationId, {
                token: params.token,
            });
            router.replace(DEFAULT_SIGNED_IN_ROUTE);
        } catch (caught) {
            setError(errorMessage(caught));
            setBusy(false);
        }
    }, [params, acceptInvitation, router, errorMessage]);

    const registerHref = preview
        ? withNext(`${ROUTES.register}?email=${encodeURIComponent(preview.email)}`, here)
        : ROUTES.register;

    return (
        <AcceptInvitationView
            state={state}
            preview={preview}
            signedInEmail={session?.user.email ?? user?.email ?? null}
            loginHref={withNext(ROUTES.login, here)}
            registerHref={registerHref}
            verifyHref={withNext(ROUTES.verifyEmail, here)}
            busy={busy}
            error={state === 'error' ? errorMessage(previewError) : error}
            onAccept={() => void accept()}
            onSwitchAccount={() => void signOut()}
            onRetry={previewQuery.reload}
        />
    );
}
