/**
 * THE HTTP SURFACE, NAMED ONCE
 *
 * Each top-level segment is one Cloud Function (`apps/functions/src/index.ts`) and one `RouterModule` prefix on
 * the local server (`apps/api/src/app.module.ts`), so a URL is the same everywhere:
 *
 *   local      http://localhost:3100/account/session
 *   emulator   http://127.0.0.1:5001/demo-template/us-central1/account/session
 *   deployed   https://us-central1-<project>.cloudfunctions.net/account/session
 *
 * The web builds every URL from these helpers, never from string literals.
 */
export const API_FUNCTIONS = ['account', 'workspaces'] as const;
export type ApiFunctionName = (typeof API_FUNCTIONS)[number];

const enc = encodeURIComponent;

export const apiRoutes = {
    health: (fn: ApiFunctionName) => `/${fn}/health`,
    account: {
        register: () => '/account/register',
        session: () => '/account/session',
        profile: () => '/account/profile',
        activeWorkspace: () => '/account/active-workspace',
    },
    workspaces: {
        create: () => '/workspaces',
        one: (workspaceId: string) => `/workspaces/${enc(workspaceId)}`,
        members: (workspaceId: string) => `/workspaces/${enc(workspaceId)}/members`,
        member: (workspaceId: string, userId: string) =>
            `/workspaces/${enc(workspaceId)}/members/${enc(userId)}`,
        invitations: (workspaceId: string) => `/workspaces/${enc(workspaceId)}/invitations`,
        invitation: (workspaceId: string, invitationId: string) =>
            `/workspaces/${enc(workspaceId)}/invitations/${enc(invitationId)}`,
        invitationPreview: (workspaceId: string, invitationId: string) =>
            `/workspaces/${enc(workspaceId)}/invitations/${enc(invitationId)}/preview`,
        acceptInvitation: (workspaceId: string, invitationId: string) =>
            `/workspaces/${enc(workspaceId)}/invitations/${enc(invitationId)}/accept`,
        flags: (workspaceId: string) => `/workspaces/${enc(workspaceId)}/flags`,
        flag: (workspaceId: string, flagKey: string) =>
            `/workspaces/${enc(workspaceId)}/flags/${enc(flagKey)}`,
    },
} as const;

/** The custom headers the web sends; the API's CORS allow-list names exactly these. */
export const REQUEST_ID_HEADER = 'X-Request-Id';
