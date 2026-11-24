import { describe, expect, it } from 'vitest';
import { identity } from '@app/api-core/testing/identities';
import { createKit } from '../testing/workspace-kit';

describe('AccountService', () => {
    it('registers a person with their first workspace, as owner and active', async () => {
        const kit = createKit();
        const { session } = await kit.register('ada', 'Acme Inc.');
        expect(session.user).toMatchObject({
            id: 'ada',
            email: 'ada@example.com',
            displayName: 'ADA',
            locale: 'en',
        });
        expect(session.workspace).toMatchObject({
            name: 'Acme Inc.',
            slug: 'acme-inc',
            ownerId: 'ada',
        });
        expect(session.role).toBe('OWNER');
        expect(session.permissions).toContain('members:manage');
        expect(session.memberships).toEqual([
            {
                workspaceId: session.workspace?.id,
                name: 'Acme Inc.',
                slug: 'acme-inc',
                role: 'OWNER',
            },
        ]);
        expect(await kit.store.get('workspaceSlugs/acme-inc')).toEqual({
            workspaceId: session.workspace?.id,
        });
    });

    it('registers without a workspace when joining through an invitation', async () => {
        const { session } = await createKit().register('bob');
        expect(session).toMatchObject({
            workspace: null,
            role: null,
            permissions: [],
            memberships: [],
        });
        expect(session.user.activeWorkspaceId).toBeNull();
    });

    it('refuses to register twice', async () => {
        const kit = createKit();
        await kit.register('ada', 'Acme');
        await expect(kit.register('ada', 'Acme')).rejects.toMatchObject({
            code: 'ALREADY_REGISTERED',
        });
    });

    it('makes derived slugs unique with a suffix', async () => {
        const kit = createKit();
        await kit.register('ada', 'Acme');
        const { session } = await kit.register('bob', 'Acme');
        expect(session.workspace?.slug).toBe('acme-2');
    });

    it('copies a new display name into every membership', async () => {
        const kit = createKit();
        const { who, session } = await kit.register('ada', 'Acme');
        const workspaceId = session.workspace?.id as string;
        const updated = await kit.account.updateProfile(await kit.auth(who), {
            displayName: 'Ada L.',
            locale: 'es',
        });
        expect(updated.user).toMatchObject({ displayName: 'Ada L.', locale: 'es' });
        expect(await kit.members.list(workspaceId)).toEqual([
            expect.objectContaining({ displayName: 'Ada L.' }),
        ]);
    });

    it('switches only to a workspace the person belongs to', async () => {
        const kit = createKit();
        const { who: ada, session } = await kit.register('ada', 'Acme');
        const { who: bob, session: other } = await kit.register('bob', 'Other');
        await expect(
            kit.account.switchActiveWorkspace(await kit.auth(ada), {
                workspaceId: other.workspace?.id as string,
            }),
        ).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
        const created = await kit.workspaces.create(await kit.auth(ada), { name: 'Second' });
        expect(created.workspace?.name).toBe('Second');
        const back = await kit.account.switchActiveWorkspace(await kit.auth(ada), {
            workspaceId: session.workspace?.id as string,
        });
        expect(back.workspace?.name).toBe('Acme');
        expect(back.memberships.map((m) => m.name)).toEqual(['Acme', 'Second']);
        expect(bob.userId).toBe('bob');
    });

    it('carries the flags evaluated for the person in the active workspace', async () => {
        const kit = createKit();
        const { who, session } = await kit.register('ada', 'Acme');
        const acme = session.workspace?.id as string;
        expect(session.flags).toEqual({ 'dashboard-whats-new': false });
        await kit.flags.writeRule(
            'dashboard-whats-new',
            {
                enabled: true,
                value: true,
                percent: 0,
                bucketBy: 'user',
                allowList: { userIds: [], workspaceIds: [acme] },
            },
            'ada',
        );
        expect((await kit.sessions.build(who)).flags['dashboard-whats-new']).toBe(true);
        const elsewhere = await kit.workspaces.create(await kit.auth(who), { name: 'Second' });
        expect(elsewhere.flags['dashboard-whats-new']).toBe(false);
    });

    it('reports emailVerified from the identity', async () => {
        const kit = createKit();
        await kit.register('ada', 'Acme');
        const session = await kit.sessions.build(identity('ada', 'ada@example.com', false));
        expect(session.emailVerified).toBe(false);
    });
});
