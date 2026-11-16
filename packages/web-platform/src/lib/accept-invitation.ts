import type { InvitationPreview, Session } from '@app/contracts';
import { isApiError, needsEmailVerification, type AuthStatus } from '@app/web-kit';

export type AcceptState =
    | 'loading'
    | 'invalid'
    | 'expired'
    | 'error'
    | 'signed-out'
    | 'needs-registration'
    | 'needs-verification'
    | 'wrong-account'
    | 'ready';

export interface AcceptInvitationParams {
    readonly workspaceId: string;
    readonly invitationId: string;
    readonly token: string;
}

/** The three query parameters of an invitation link; `null` if any is missing. */
export function readAcceptParams(search: URLSearchParams): AcceptInvitationParams | null {
    const workspaceId = search.get('workspace');
    const invitationId = search.get('invitation');
    const token = search.get('token');
    return workspaceId && invitationId && token ? { workspaceId, invitationId, token } : null;
}

/**
 * What the accept screen shows, from the link, its public preview and who is signed in. The invitation is checked
 * first: there is no point in asking someone to sign in for a link that no longer works.
 */
export function acceptState(input: {
    readonly params: AcceptInvitationParams | null;
    readonly preview: InvitationPreview | null;
    readonly previewError: unknown;
    readonly status: AuthStatus;
    readonly session: Session | null;
    readonly signedInEmail: string | null;
}): AcceptState {
    const { params, preview, previewError, status, session, signedInEmail } = input;
    if (!params) return 'invalid';
    if (previewError) {
        if (isApiError(previewError, 'INVITATION_EXPIRED')) return 'expired';
        if (isApiError(previewError, 'INVITATION_INVALID') || isApiError(previewError, 'NOT_FOUND'))
            return 'invalid';
        return 'error';
    }
    if (!preview || status === 'loading') return 'loading';
    if (status === 'error') return 'error';
    if (status === 'signed-out') return 'signed-out';
    const email = (session?.user.email ?? signedInEmail ?? '').toLowerCase();
    if (email && email !== preview.email.toLowerCase()) return 'wrong-account';
    if (status === 'unregistered') return 'needs-registration';
    if (needsEmailVerification(session)) return 'needs-verification';
    return 'ready';
}
