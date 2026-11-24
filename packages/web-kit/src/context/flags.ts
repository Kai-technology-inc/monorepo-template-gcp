'use client';

import { FLAGS, type FlagKey, type FlagValue, type Session } from '@app/contracts';
import { useAuth } from './AuthContext';

/**
 * The value of a flag in this session: what the API evaluated for the person in their active workspace, or the
 * declared default while there is no session (signed out, loading).
 */
export function sessionFlag<K extends FlagKey>(session: Session | null, key: K): FlagValue<K> {
    return (session?.flags[key] ?? FLAGS[key].defaultValue) as FlagValue<K>;
}

/**
 * A FLAG, IN A SCREEN
 *
 * `const whatsNew = useFlag('dashboard-whats-new')`. The browser never evaluates flags: the API sends their values
 * with the session (parsed with the contract), so no provider SDK or key reaches the client, and switching workspace
 * re-evaluates them. The key must be declared in `FLAGS` (@app/contracts); docs/FLAGS.md is the whole story.
 */
export function useFlag<K extends FlagKey>(key: K): FlagValue<K> {
    return sessionFlag(useAuth().session, key);
}
