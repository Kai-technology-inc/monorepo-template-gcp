import { describe, expect, it } from 'vitest';
import { where } from '../persistence/store';
import { InMemoryStore } from './in-memory-store';

describe('InMemoryStore', () => {
    it('queries a collection and a collection group', async () => {
        const store = new InMemoryStore();
        store.seed('workspaces/w1/members/u1', { userId: 'u1', role: 'OWNER' });
        store.seed('workspaces/w2/members/u1', { userId: 'u1', role: 'MEMBER' });
        store.seed('workspaces/w2/members/u2', { userId: 'u2', role: 'OWNER' });
        expect((await store.query('workspaces/w2/members')).map((d) => d.id)).toEqual(['u1', 'u2']);
        expect(
            (await store.collectionGroup('members', [where('userId', '==', 'u1')])).map(
                (d) => d.path,
            ),
        ).toEqual(['workspaces/w1/members/u1', 'workspaces/w2/members/u1']);
    });

    it('applies a transaction atomically', async () => {
        const store = new InMemoryStore();
        store.seed('a/1', { n: 1 });
        await expect(
            store.runTransaction(async (tx) => {
                await tx.get('a/1');
                tx.set('a/2', { n: 2 });
                tx.create('a/1', { n: 3 });
            }),
        ).rejects.toMatchObject({ code: 6 });
        expect(store.paths()).toEqual(['a/1']);
    });

    it('rejects a read after a write, like Firestore', async () => {
        const store = new InMemoryStore();
        await expect(
            store.runTransaction(async (tx) => {
                tx.set('a/1', {});
                await tx.get('a/1');
            }),
        ).rejects.toThrow(/reads to be executed before all writes/);
    });

    it('runs transactions one at a time', async () => {
        const store = new InMemoryStore();
        store.seed('counter/c', { n: 0 });
        await Promise.all(
            Array.from({ length: 10 }, () =>
                store.runTransaction(async (tx) => {
                    const current = (await tx.get('counter/c'))?.n as number;
                    tx.update('counter/c', { n: current + 1 });
                }),
            ),
        );
        expect(await store.get('counter/c')).toEqual({ n: 10 });
    });
});
