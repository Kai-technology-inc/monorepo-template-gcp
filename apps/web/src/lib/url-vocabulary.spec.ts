import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { invalidWebSegments } from '@app/contracts';

/**
 * Every route of the web is English, lowercase and kebab-case, whatever language the screen speaks. A new folder
 * under `src/app` that breaks the rule fails here (see `packages/contracts/src/url-vocabulary.ts`).
 */
const APP_DIR = path.join(__dirname, '..', 'app');

function routeFolders(dir: string, prefix = ''): string[] {
    return readdirSync(dir)
        .filter((name) => statSync(path.join(dir, name)).isDirectory())
        .flatMap((name) => {
            const route = `${prefix}/${name}`;
            return [route, ...routeFolders(path.join(dir, name), route)];
        });
}

describe('web routes', () => {
    const routes = routeFolders(APP_DIR);

    it('finds the routes', () => {
        expect(routes).toContain('/(auth)/auth/invitations/accept');
        expect(routes).toContain('/(app)/members');
    });

    it.each(routes)('%s uses the URL vocabulary', (route) => {
        expect(invalidWebSegments(route)).toEqual([]);
    });
});
