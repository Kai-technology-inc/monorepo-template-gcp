import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `firestore.rules` against the emulator (`pnpm test:rules` starts it). Every collection has a block here: who can
 * read it, and that nobody writes it from the client.
 */
describe('firestore.rules', () => {
    let env: RulesTestEnvironment;

    beforeAll(async () => {
        // Every denied write is also logged by the SDK as a warning; the assertions are what matter.
        setLogLevel('error');
        env = await initializeTestEnvironment({
            projectId: 'demo-template-rules',
            firestore: {
                rules: readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
            },
        });
    });

    afterAll(async () => {
        await env.cleanup();
    });

    beforeEach(async () => {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await setDoc(doc(db, 'users/ada'), { id: 'ada' });
            await setDoc(doc(db, 'users/bob'), { id: 'bob' });
            await setDoc(doc(db, 'workspaces/w1'), { name: 'Acme' });
            await setDoc(doc(db, 'workspaces/w1/members/ada'), { role: 'OWNER' });
            await setDoc(doc(db, 'workspaces/w1/invitations/i1'), { tokenHash: 'x' });
            await setDoc(doc(db, 'workspaceSlugs/acme'), { workspaceId: 'w1' });
        });
    });

    const as = (uid?: string) =>
        (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

    it('lets a person read only their own profile', async () => {
        await assertSucceeds(getDoc(doc(as('ada'), 'users/ada')));
        await assertFails(getDoc(doc(as('ada'), 'users/bob')));
        await assertFails(getDoc(doc(as(), 'users/ada')));
    });

    it('lets members read their workspace and its members', async () => {
        await assertSucceeds(getDoc(doc(as('ada'), 'workspaces/w1')));
        await assertSucceeds(getDoc(doc(as('ada'), 'workspaces/w1/members/ada')));
        await assertFails(getDoc(doc(as('bob'), 'workspaces/w1')));
        await assertFails(getDoc(doc(as('bob'), 'workspaces/w1/members/ada')));
    });

    it('never exposes invitations or slugs', async () => {
        await assertFails(getDoc(doc(as('ada'), 'workspaces/w1/invitations/i1')));
        await assertFails(getDoc(doc(as('ada'), 'workspaceSlugs/acme')));
    });

    it('denies every write from the client', async () => {
        await assertFails(setDoc(doc(as('ada'), 'users/ada'), { id: 'ada', displayName: 'x' }));
        await assertFails(setDoc(doc(as('ada'), 'workspaces/w1'), { name: 'Mine' }));
        await assertFails(setDoc(doc(as('ada'), 'workspaces/w1/members/bob'), { role: 'OWNER' }));
        await assertFails(setDoc(doc(as('ada'), 'anything/else'), {}));
    });
});
