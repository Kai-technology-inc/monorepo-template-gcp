import type { Session } from '@app/contracts';
import { needsEmailVerification, ROUTES, withNext, type AuthStatus } from '@app/web-kit';

export type GateDecision =
    | { readonly kind: 'wait' }
    | { readonly kind: 'error' }
    | { readonly kind: 'render' }
    | { readonly kind: 'redirect'; readonly to: string };

/**
 * WHO MAY SEE AN APP PAGE, DECIDED IN ONE PLACE
 *
 * Signed out → sign in; identity without profile → finish registration; email not verified (when the deployment
 * requires it) → verify; no workspace → settings, where one can be created. Each redirect carries the page it
 * came from, so the person lands back where they were going.
 */
export function gateDecision(
    status: AuthStatus,
    session: Session | null,
    currentPath: string,
): GateDecision {
    switch (status) {
        case 'loading':
            return { kind: 'wait' };
        case 'error':
            return { kind: 'error' };
        case 'signed-out':
            return { kind: 'redirect', to: withNext(ROUTES.login, currentPath) };
        case 'unregistered':
            return { kind: 'redirect', to: withNext(ROUTES.register, currentPath) };
        case 'ready':
            if (!session) return { kind: 'wait' };
            if (needsEmailVerification(session)) {
                return { kind: 'redirect', to: withNext(ROUTES.verifyEmail, currentPath) };
            }
            if (!session.workspace && !currentPath.startsWith(ROUTES.settings)) {
                return { kind: 'redirect', to: ROUTES.settings };
            }
            return { kind: 'render' };
    }
}
