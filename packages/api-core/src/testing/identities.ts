import type { Identity } from '../auth/auth-context';

/** A verified identity for service tests. */
export function identity(
    userId: string,
    email = `${userId}@example.com`,
    emailVerified = true,
): Identity {
    return { userId, email, displayName: userId, emailVerified };
}
