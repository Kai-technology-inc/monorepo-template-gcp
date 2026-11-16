import { describe, expect, it } from 'vitest';
import type { InvitationPreview } from '@app/contracts';
import { ApiError } from '@app/web-kit';
import { acceptState, readAcceptParams } from './accept-invitation';
import { aSession } from './fixtures';

const params = { workspaceId: 'w1', invitationId: 'i1', token: 't'.repeat(43) };
const preview: InvitationPreview = {
    workspaceName: 'Acme',
    email: 'bob@example.com',
    role: 'MEMBER',
    expiresAt: '2026-12-01T00:00:00.000Z',
};
const bob = aSession({
    user: { ...aSession().user, email: 'bob@example.com' },
    workspace: null,
    role: null,
    permissions: [],
    memberships: [],
});
const base = {
    params,
    preview,
    previewError: null,
    status: 'ready' as const,
    session: bob,
    signedInEmail: null,
};

describe('readAcceptParams', () => {
    it('needs the three parameters', () => {
        expect(readAcceptParams(new URLSearchParams('workspace=w&invitation=i&token=t'))).toEqual({
            workspaceId: 'w',
            invitationId: 'i',
            token: 't',
        });
        expect(readAcceptParams(new URLSearchParams('workspace=w&invitation=i'))).toBeNull();
    });
});

describe('acceptState', () => {
    it('checks the link before asking anyone to sign in', () => {
        expect(acceptState({ ...base, params: null })).toBe('invalid');
        expect(
            acceptState({
                ...base,
                status: 'signed-out',
                previewError: new ApiError('INVITATION_EXPIRED', 410, ''),
            }),
        ).toBe('expired');
        expect(
            acceptState({ ...base, previewError: new ApiError('INVITATION_INVALID', 404, '') }),
        ).toBe('invalid');
        expect(acceptState({ ...base, previewError: new ApiError('network', 0, '') })).toBe(
            'error',
        );
    });

    it('waits for the preview and the session', () => {
        expect(acceptState({ ...base, preview: null })).toBe('loading');
        expect(acceptState({ ...base, status: 'loading' })).toBe('loading');
    });

    it('routes by who is signed in', () => {
        expect(acceptState({ ...base, status: 'signed-out', session: null })).toBe('signed-out');
        expect(
            acceptState({
                ...base,
                status: 'unregistered',
                session: null,
                signedInEmail: 'bob@example.com',
            }),
        ).toBe('needs-registration');
        expect(acceptState({ ...base, session: aSession() })).toBe('wrong-account');
        expect(acceptState({ ...base, session: { ...bob, emailVerified: false } })).toBe(
            'needs-verification',
        );
        expect(acceptState(base)).toBe('ready');
    });

    it('compares emails case-insensitively', () => {
        expect(
            acceptState({
                ...base,
                session: { ...bob, user: { ...bob.user, email: 'Bob@Example.com' } },
            }),
        ).toBe('ready');
    });
});
