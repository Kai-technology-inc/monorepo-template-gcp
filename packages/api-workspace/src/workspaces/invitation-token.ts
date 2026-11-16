import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url: the secret in an invitation link. Only its hash is stored. */
export function newInvitationToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of a presented token against the stored hash. */
export function matchesInvitationToken(token: string, storedHash: string): boolean {
    const presented = Buffer.from(hashInvitationToken(token), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return presented.length === stored.length && timingSafeEqual(presented, stored);
}
