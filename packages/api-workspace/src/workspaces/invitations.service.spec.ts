import { beforeEach, describe, expect, it } from 'vitest';
import type { Identity } from '@app/api-core/auth/auth-context';
import { identity } from '@app/api-core/testing/identities';
import { createKit } from '../testing/workspace-kit';
import { hashInvitationToken } from './invitation-token';

function tokenOf(acceptPath: string): string {
    return new URLSearchParams(acceptPath.split('?')[1]).get('token') as string;
}

describe('InvitationsService', () => {
    let kit: ReturnType<typeof createKit>;
    let owner: Identity;
    let workspaceId: string;

    beforeEach(async () => {
        kit = createKit();
        const registered = await kit.register('ada', 'Acme');
        owner = registered.who;
        workspaceId = registered.session.workspace?.id as string;
    });

    const invite = async (email = 'bob@example.com', role: 'ADMIN' | 'MEMBER' = 'MEMBER') =>
        kit.invitations.create(await kit.auth(owner, workspaceId), workspaceId, { email, role });

    it('stores only the hash of the token and returns a web path', async () => {
        const { invitation, acceptPath } = await invite();
        expect(acceptPath).toMatch(
            new RegExp(
                `^/auth/invitations/accept\\?workspace=${workspaceId}&invitation=${invitation.id}&token=`,
            ),
        );
        const stored = await kit.store.get(
            `workspaces/${workspaceId}/invitations/${invitation.id}`,
        );
        expect(stored?.tokenHash).toBe(hashInvitationToken(tokenOf(acceptPath)));
        expect(JSON.stringify(stored)).not.toContain(tokenOf(acceptPath));
        expect(invitation).not.toHaveProperty('tokenHash');
        expect(invitation).toMatchObject({
            status: 'PENDING',
            workspaceName: 'Acme',
            expiresAt: '2026-01-08T00:00:00.000Z',
        });
    });

    it('previews with the right token only', async () => {
        const { invitation, acceptPath } = await invite();
        expect(
            await kit.invitations.preview(workspaceId, invitation.id, tokenOf(acceptPath)),
        ).toEqual({
            workspaceName: 'Acme',
            email: 'bob@example.com',
            role: 'MEMBER',
            expiresAt: '2026-01-08T00:00:00.000Z',
        });
        await expect(
            kit.invitations.preview(workspaceId, invitation.id, 'x'.repeat(43)),
        ).rejects.toMatchObject({
            code: 'INVITATION_INVALID',
        });
    });

    it('accepts: membership, invitation and active workspace in one go', async () => {
        const { invitation, acceptPath } = await invite('bob@example.com', 'ADMIN');
        const { who: bob } = await kit.register('bob');
        const session = await kit.invitations.accept(
            await kit.auth(bob, workspaceId),
            workspaceId,
            invitation.id,
            tokenOf(acceptPath),
        );
        expect(session).toMatchObject({ role: 'ADMIN', workspace: { id: workspaceId } });
        expect(
            await kit.store.get(`workspaces/${workspaceId}/invitations/${invitation.id}`),
        ).toMatchObject({
            status: 'ACCEPTED',
            acceptedBy: 'bob',
        });
        await expect(
            kit.invitations.accept(
                await kit.auth(bob, workspaceId),
                workspaceId,
                invitation.id,
                tokenOf(acceptPath),
            ),
        ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    });

    it('refuses another email', async () => {
        const { invitation, acceptPath } = await invite();
        const { who: eve } = await kit.register('eve');
        await expect(
            kit.invitations.accept(
                await kit.auth(eve, workspaceId),
                workspaceId,
                invitation.id,
                tokenOf(acceptPath),
            ),
        ).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    });

    it('expires after the TTL', async () => {
        const { invitation, acceptPath } = await invite();
        kit.clock.set('2026-01-08T00:00:00.000Z');
        await expect(
            kit.invitations.preview(workspaceId, invitation.id, tokenOf(acceptPath)),
        ).rejects.toMatchObject({
            code: 'INVITATION_EXPIRED',
        });
        expect(await kit.invitations.list(workspaceId)).toEqual([]);
    });

    it('revokes the previous invitation when the same email is invited again', async () => {
        const first = await invite();
        const second = await invite();
        await expect(
            kit.invitations.preview(workspaceId, first.invitation.id, tokenOf(first.acceptPath)),
        ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
        expect((await kit.invitations.list(workspaceId)).map((i) => i.id)).toEqual([
            second.invitation.id,
        ]);
    });

    it('refuses to invite a member, and to accept twice into the same workspace', async () => {
        await expect(invite('ada@example.com')).rejects.toMatchObject({ code: 'ALREADY_A_MEMBER' });
        const { invitation, acceptPath } = await invite('ada@example.com'.replace('ada', 'bob'));
        const bob = identity('bob');
        await kit.register('bob');
        const again = await invite('bob@example.com');
        await kit.invitations.accept(
            await kit.auth(bob, workspaceId),
            workspaceId,
            again.invitation.id,
            tokenOf(again.acceptPath),
        );
        await expect(
            kit.invitations.accept(
                await kit.auth(bob, workspaceId),
                workspaceId,
                invitation.id,
                tokenOf(acceptPath),
            ),
        ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    });

    it('revokes', async () => {
        const { invitation, acceptPath } = await invite();
        await kit.invitations.revoke(workspaceId, invitation.id);
        await expect(
            kit.invitations.preview(workspaceId, invitation.id, tokenOf(acceptPath)),
        ).rejects.toMatchObject({
            code: 'INVITATION_INVALID',
        });
        await expect(kit.invitations.revoke(workspaceId, invitation.id)).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });
});
