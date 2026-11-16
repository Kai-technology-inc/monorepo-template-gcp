import type { Member, Session } from '@app/contracts';

/** Test data shared by the specs. */
export function aSession(overrides: Partial<Session> = {}): Session {
    return {
        user: {
            id: 'u-owner',
            email: 'ada@example.com',
            displayName: 'Ada',
            locale: 'en',
            activeWorkspaceId: 'w1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
        workspace: {
            id: 'w1',
            name: 'Acme',
            slug: 'acme',
            ownerId: 'u-owner',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
        role: 'OWNER',
        permissions: [
            'workspace:read',
            'workspace:update',
            'members:read',
            'members:manage',
            'invitations:manage',
        ],
        memberships: [{ workspaceId: 'w1', name: 'Acme', slug: 'acme', role: 'OWNER' }],
        emailVerified: true,
        emailVerificationRequired: true,
        ...overrides,
    };
}

export function aMember(overrides: Partial<Member> = {}): Member {
    return {
        userId: 'u-x',
        email: 'x@example.com',
        displayName: 'X',
        role: 'MEMBER',
        joinedAt: '2026-01-02T00:00:00.000Z',
        ...overrides,
    };
}
