import { describe, expect, it } from '@jest/globals';
import { createKit } from '../testing/workspace-kit';

describe('WorkspacesService', () => {
    it('creates a workspace owned by the caller and switches to it', async () => {
        const kit = createKit();
        const { who } = await kit.register('ada', 'Acme');
        const session = await kit.workspaces.create(await kit.auth(who), {
            name: 'Beta',
            slug: 'beta-team',
        });
        expect(session.workspace).toMatchObject({
            name: 'Beta',
            slug: 'beta-team',
            ownerId: 'ada',
        });
        expect(session.role).toBe('OWNER');
    });

    it('refuses an explicit slug that is taken', async () => {
        const kit = createKit();
        const { who } = await kit.register('ada', 'Acme');
        await expect(
            kit.workspaces.create(await kit.auth(who), { name: 'Other', slug: 'acme' }),
        ).rejects.toMatchObject({
            code: 'SLUG_TAKEN',
        });
    });

    it('keeps a long derived slug within 40 characters when suffixed', async () => {
        const kit = createKit();
        const name = 'A very long company name that goes on and on';
        await kit.register('ada', name);
        const { session } = await kit.register('bob', name);
        expect(session.workspace?.slug).toMatch(/^[a-z0-9-]{3,40}$/);
        expect(session.workspace?.slug.endsWith('-2')).toBe(true);
    });

    it('renames a workspace', async () => {
        const kit = createKit();
        const { session } = await kit.register('ada', 'Acme');
        kit.clock.advance(1000);
        const updated = await kit.workspaces.update(session.workspace?.id as string, {
            name: 'Acme Corp',
        });
        expect(updated).toMatchObject({ name: 'Acme Corp', updatedAt: '2026-01-01T00:00:01.000Z' });
    });
});
