import { AppError } from '../http/app-error';

/**
 * WHERE EVERY DOCUMENT LIVES
 *
 * The only place that spells a Firestore path. The layout is described in docs/API.md ("Firestore layout") and
 * guarded by `firestore.rules`; a new collection is a line here, a section there and a rule there.
 *
 * Every id goes through `segment()`. Route params arrive URL-decoded, so `/workspaces/a%2Fmembers%2Fx/...` would
 * otherwise reach Firestore as a different path: a slash, an empty id, `.`/`..` or a reserved `__x__` id is
 * answered as a `404` before any read.
 */
export function segment(id: string): string {
    if (
        !id ||
        id.length > 1500 ||
        id.includes('/') ||
        id === '.' ||
        id === '..' ||
        /^__.*__$/.test(id)
    ) {
        throw new AppError('NOT_FOUND', 404, 'Invalid id');
    }
    return id;
}

export const paths = {
    user: (userId: string) => `users/${segment(userId)}`,
    workspace: (workspaceId: string) => `workspaces/${segment(workspaceId)}`,
    members: (workspaceId: string) => `workspaces/${segment(workspaceId)}/members`,
    member: (workspaceId: string, userId: string) =>
        `workspaces/${segment(workspaceId)}/members/${segment(userId)}`,
    invitations: (workspaceId: string) => `workspaces/${segment(workspaceId)}/invitations`,
    invitation: (workspaceId: string, invitationId: string) =>
        `workspaces/${segment(workspaceId)}/invitations/${segment(invitationId)}`,
    workspaceSlug: (slug: string) => `workspaceSlugs/${segment(slug)}`,
    /** Feature-flag rules of the own provider (`FLAGS_PROVIDER=firestore`): global to the deployment, API only. */
    flags: () => 'flags',
    flag: (flagKey: string) => `flags/${segment(flagKey)}`,
} as const;

/** The collection-group id of memberships: `collectionGroup('members')` finds a person's workspaces. */
export const MEMBERS_COLLECTION = 'members';
