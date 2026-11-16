import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API_FUNCTIONS, invalidApiSegments } from '@app/contracts';
import { FUNCTION_MODULES } from '../app.module';
import { REPO_ROOT } from './repo';
import { apiRoutes } from './routes';

/**
 * EVERY ROUTE IS ENGLISH KEBAB-CASE, BELONGS TO A FUNCTION, AND IS DOCUMENTED
 *
 * A route with `miembros` or `activeWorkspace` in it fails here (`packages/contracts/src/url-vocabulary.ts`), and so
 * does a route missing from docs/API.md: the doc is the contract the web and other clients are written against.
 */
describe('API routes', () => {
    const routes = apiRoutes();

    it('are found', () => {
        expect(routes.length).toBeGreaterThan(10);
    });

    it('use the URL vocabulary', () => {
        const invalid = routes.filter((route) => invalidApiSegments(route.path).length > 0);
        expect(invalid).toEqual([]);
    });

    it('are served by exactly the functions in API_FUNCTIONS', () => {
        expect(Object.keys(FUNCTION_MODULES).sort()).toEqual([...API_FUNCTIONS].sort());
        for (const route of routes) {
            expect(API_FUNCTIONS).toContain(route.path.split('/')[1]);
        }
    });

    it('are all documented in docs/API.md', () => {
        const doc = readFileSync(path.join(REPO_ROOT, 'docs/API.md'), 'utf8');
        const documented = new Set(
            [...doc.matchAll(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`?]+)/gm)].map(
                (match) => `${match[1]} ${match[2].trim()}`,
            ),
        );
        const missing = routes
            .map((r) => `${r.method} ${r.path}`)
            .filter((route) => !documented.has(route));
        expect(missing).toEqual([]);
    });
});
