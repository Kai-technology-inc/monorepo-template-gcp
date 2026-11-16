import { afterAll, beforeAll, describe, it } from 'vitest';
import {
    assertFails,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('storage.rules', () => {
    let env: RulesTestEnvironment;

    beforeAll(async () => {
        env = await initializeTestEnvironment({
            projectId: 'demo-template-rules',
            storage: { rules: readFileSync(path.join(__dirname, '../../storage.rules'), 'utf8') },
        });
    });

    afterAll(async () => {
        await env.cleanup();
    });

    it('denies everything from the client', async () => {
        const storage = env.authenticatedContext('ada').storage();
        await assertFails(uploadString(ref(storage, 'workspaces/w1/file.txt'), 'hello'));
        await assertFails(getBytes(ref(storage, 'workspaces/w1/file.txt')));
    });
});
