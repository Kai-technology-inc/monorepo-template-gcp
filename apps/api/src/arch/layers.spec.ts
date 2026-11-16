import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import { REPO_ROOT, sourceFiles, workspaceImports, workspacePackages } from './repo';

/**
 * THE LAYERS, ENFORCED
 *
 * What each package may import from the workspace. ESLint flags the same in the editor (each package's
 * `eslint.config.mjs`), but a lint rule can be silenced with a comment and this cannot. A package that is not listed
 * fails here: deciding its layer is part of creating it (docs/ARCHITECTURE.md).
 *
 *   contracts            → nothing                       layer 0: the shared model
 *   i18n                 → contracts                     the language module
 *   api-core             → contracts                     layer 1 of the API
 *   api-workspace        → api-core, contracts           layer 2: product modules
 *   api-host             → api-*, contracts              composition
 *   api, functions       → api-*, contracts              the deployables
 *   web-kit              → contracts, i18n               the web's primitives
 *   web-*, web           → contracts, i18n, web-*        never the API packages: they talk to it over HTTP
 */
const API_PACKAGES = ['@app/api-core', '@app/api-workspace', '@app/api-host'];

const ALLOWED: Readonly<Record<string, readonly string[]>> = {
    '@app/contracts': [],
    '@app/eslint-config': [],
    '@app/i18n': ['@app/contracts'],
    '@app/api-core': ['@app/contracts'],
    '@app/api-workspace': ['@app/api-core', '@app/contracts'],
    '@app/api-host': [...API_PACKAGES, '@app/contracts'],
    '@app/api': [...API_PACKAGES, '@app/contracts'],
    '@app/functions': [...API_PACKAGES, '@app/contracts'],
    '@app/web-kit': ['@app/contracts', '@app/i18n'],
};

/** Web packages added later (`web-billing`…) follow the web rule without being listed one by one. */
function allowedFor(name: string): readonly string[] | undefined {
    if (ALLOWED[name]) return ALLOWED[name];
    if (name === '@app/web' || name.startsWith('@app/web-')) {
        return ['@app/contracts', '@app/i18n', '@app/web-kit', '@app/web-platform'].filter(
            (dep) => dep !== name,
        );
    }
    if (name.startsWith('@app/api-'))
        return ['@app/api-core', '@app/api-workspace', '@app/contracts'];
    return undefined;
}

describe('layers', () => {
    const packages = workspacePackages();

    it('finds the workspace packages', () => {
        expect(packages.map((p) => p.name)).toEqual(
            expect.arrayContaining(['@app/contracts', '@app/api-core']),
        );
    });

    it.each(packages.map((p) => [p.name, p.dir] as const))(
        '%s imports only what its layer allows',
        (name, dir) => {
            const allowed = allowedFor(name);
            expect({ package: name, declaredLayer: allowed !== undefined }).toEqual({
                package: name,
                declaredLayer: true,
            });
            const violations = sourceFiles(path.join(dir, 'src')).flatMap((file) =>
                workspaceImports(file)
                    .filter((dep) => dep !== name && !(allowed ?? []).includes(dep))
                    .map((dep) => `${path.relative(REPO_ROOT, file)} → ${dep}`),
            );
            expect(violations).toEqual([]);
        },
    );
});
