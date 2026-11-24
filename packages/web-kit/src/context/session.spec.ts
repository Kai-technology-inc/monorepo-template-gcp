import { describe, expect, it } from 'vitest';
import { FLAG_DEFAULTS, type Session } from '@app/contracts';
import { needsEmailVerification, sessionCan } from './AuthContext';

const session = (overrides: Partial<Session> = {}): Session => ({
    user: {
        id: 'u1',
        email: 'ada@example.com',
        displayName: 'Ada',
        locale: 'en',
        activeWorkspaceId: 'w1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    workspace: null,
    role: 'MEMBER',
    permissions: ['workspace:read', 'members:read'],
    memberships: [],
    emailVerified: true,
    emailVerificationRequired: true,
    flags: FLAG_DEFAULTS,
    ...overrides,
});

describe('session helpers', () => {
    it('checks permissions of the active workspace', () => {
        expect(sessionCan(session(), 'members:read')).toBe(true);
        expect(sessionCan(session(), 'members:manage')).toBe(false);
        expect(sessionCan(null, 'members:read')).toBe(false);
    });

    it('asks for verification only when the deployment requires it', () => {
        expect(needsEmailVerification(session({ emailVerified: false }))).toBe(true);
        expect(
            needsEmailVerification(
                session({ emailVerified: false, emailVerificationRequired: false }),
            ),
        ).toBe(false);
        expect(needsEmailVerification(session())).toBe(false);
    });
});
