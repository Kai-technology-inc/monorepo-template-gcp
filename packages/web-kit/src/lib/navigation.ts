/**
 * WHERE THINGS LIVE IN THE WEB, NAMED ONCE
 *
 * Screens link with these helpers, never with string literals, so moving a route is a one-line change. Segments are
 * English and kebab-case (checked by `apps/web/src/lib/url-vocabulary.spec.ts`).
 */
export const ROUTES = {
    home: '/',
    dashboard: '/dashboard',
    members: '/members',
    settings: '/settings',
    login: '/auth/login',
    register: '/auth/register',
    forgotPassword: '/auth/forgot-password',
    verifyEmail: '/auth/verify-email',
    action: '/auth/action',
    acceptInvitation: '/auth/invitations/accept',
} as const;

/** Where a signed-in person lands when nothing else was asked for. */
export const DEFAULT_SIGNED_IN_ROUTE = ROUTES.dashboard;

/**
 * The `next` query parameter, only if it is a path on this site. Anything else (`https://evil.example`,
 * `//evil.example`, `/\evil`) is dropped: an open redirect after sign-in is a phishing tool.
 */
export function safeNextPath(
    next: string | null | undefined,
    fallback: string = DEFAULT_SIGNED_IN_ROUTE,
): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
        return fallback;
    return next;
}

export function withNext(path: string, next: string | null | undefined): string {
    if (!next) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}next=${encodeURIComponent(next)}`;
}
