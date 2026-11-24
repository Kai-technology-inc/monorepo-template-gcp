import { describe, expect, it } from 'vitest';
import { FLAG_DEFAULTS, SessionSchema, type Session } from '@app/contracts';
import { sessionFlag } from './flags';

const session = (flags: unknown): Session =>
    SessionSchema.parse({
        user: {
            id: 'u1',
            email: 'ada@example.com',
            displayName: 'Ada',
            locale: 'en',
            activeWorkspaceId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        },
        workspace: null,
        role: null,
        permissions: [],
        memberships: [],
        emailVerified: true,
        emailVerificationRequired: false,
        flags,
    });

describe('sessionFlag', () => {
    it('reads what the API evaluated', () => {
        expect(sessionFlag(session({ 'dashboard-whats-new': true }), 'dashboard-whats-new')).toBe(
            true,
        );
    });

    it('falls back to the declared default without a session or with a malformed value', () => {
        expect(sessionFlag(null, 'dashboard-whats-new')).toBe(false);
        expect(sessionFlag(session({ 'dashboard-whats-new': 'yes' }), 'dashboard-whats-new')).toBe(
            false,
        );
        expect(session(undefined).flags).toEqual(FLAG_DEFAULTS);
    });
});
