import { beforeEach, describe, expect, it } from 'vitest';
import type { Identity } from '@app/api-core/auth/auth-context';
import { createKit } from '../testing/workspace-kit';

describe('MembersService', () => {
    let kit: ReturnType<typeof createKit>;
    let owner: Identity;
    let workspaceId: string;

    beforeEach(async () => {
        kit = createKit();
        const registered = await kit.register('ada', 'Acme');
        owner = registered.who;
        workspaceId = registered.session.workspace?.id as string;
    });

    it('lists members in joining order', async () => {
        await kit.join(owner, workspaceId, 'bob');
        expect((await kit.members.list(workspaceId)).map((m) => [m.userId, m.role])).toEqual([
            ['ada', 'OWNER'],
            ['bob', 'MEMBER'],
        ]);
    });

    it('does not let anyone change their own role', async () => {
        await expect(
            kit.members.changeRole(
                await kit.auth(owner, workspaceId),
                workspaceId,
                'ada',
                'MEMBER',
            ),
        ).rejects.toMatchObject({ code: 'CANNOT_CHANGE_OWN_ROLE' });
    });

    it('lets only owners grant or revoke ownership', async () => {
        const admin = await kit.join(owner, workspaceId, 'bob', 'ADMIN');
        await kit.join(owner, workspaceId, 'cy');
        await expect(
            kit.members.changeRole(await kit.auth(admin, workspaceId), workspaceId, 'cy', 'OWNER'),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(
            kit.members.changeRole(
                await kit.auth(admin, workspaceId),
                workspaceId,
                'ada',
                'MEMBER',
            ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(
            await kit.members.changeRole(
                await kit.auth(admin, workspaceId),
                workspaceId,
                'cy',
                'ADMIN',
            ),
        ).toMatchObject({ userId: 'cy', role: 'ADMIN' });
        expect(
            await kit.members.changeRole(
                await kit.auth(owner, workspaceId),
                workspaceId,
                'cy',
                'OWNER',
            ),
        ).toMatchObject({ role: 'OWNER' });
    });

    it('never leaves a workspace without an owner', async () => {
        await expect(
            kit.members.remove(await kit.auth(owner, workspaceId), workspaceId, 'ada'),
        ).rejects.toMatchObject({
            code: 'LAST_OWNER',
        });
        const second = await kit.join(owner, workspaceId, 'bob');
        await kit.members.changeRole(
            await kit.auth(owner, workspaceId),
            workspaceId,
            'bob',
            'OWNER',
        );
        await kit.members.changeRole(
            await kit.auth(second, workspaceId),
            workspaceId,
            'ada',
            'MEMBER',
        );
        await expect(
            kit.members.changeRole(
                await kit.auth(owner, workspaceId),
                workspaceId,
                'bob',
                'MEMBER',
            ),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(
            kit.members.remove(await kit.auth(second, workspaceId), workspaceId, 'bob'),
        ).rejects.toMatchObject({
            code: 'LAST_OWNER',
        });
    });

    it('lets a member leave but not remove others', async () => {
        const member = await kit.join(owner, workspaceId, 'bob');
        await kit.join(owner, workspaceId, 'cy');
        await expect(
            kit.members.remove(await kit.auth(member, workspaceId), workspaceId, 'cy'),
        ).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
        await kit.members.remove(await kit.auth(member, workspaceId), workspaceId, 'bob');
        expect((await kit.members.list(workspaceId)).map((m) => m.userId)).toEqual(['ada', 'cy']);
    });

    it('does not let an admin remove an owner', async () => {
        const admin = await kit.join(owner, workspaceId, 'bob', 'ADMIN');
        await expect(
            kit.members.remove(await kit.auth(admin, workspaceId), workspaceId, 'ada'),
        ).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });

    it('moves the removed person to another workspace, or to none', async () => {
        const bob = await kit.join(owner, workspaceId, 'bob');
        const other = await kit.workspaces.create(await kit.auth(owner), { name: 'Other' });
        const otherId = other.workspace?.id as string;
        await kit.join(owner, otherId, 'cy');
        // bob's only workspace is Acme (active); removing him leaves him with none.
        await kit.members.remove(await kit.auth(owner, workspaceId), workspaceId, 'bob');
        expect((await kit.sessions.build(bob)).workspace).toBeNull();
        // ada is active in Other; leaving Other moves her back to Acme.
        await kit.members.changeRole(await kit.auth(owner, otherId), otherId, 'cy', 'OWNER');
        await kit.members.remove(await kit.auth(owner, otherId), otherId, 'ada');
        expect((await kit.sessions.build(owner)).workspace?.id).toBe(workspaceId);
    });

    it('answers 404 for someone who is not a member', async () => {
        await expect(
            kit.members.changeRole(
                await kit.auth(owner, workspaceId),
                workspaceId,
                'ghost',
                'ADMIN',
            ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
