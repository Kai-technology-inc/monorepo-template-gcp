import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FLAG_KEYS, isFlagKey } from '@app/contracts';
import { REPO_ROOT, sourceFiles, workspacePackages } from './repo';

/**
 * EVERY FLAG THE CODE ASKS FOR IS DECLARED, AND EVERY DECLARED FLAG IS STILL ASKED FOR
 *
 * TypeScript already refuses `useFlag('typo')`; this also catches what slips past it (a cast, a key in a string
 * built by hand) and the opposite case: a flag in `FLAGS` that no code reads anymore is stale (its rollout ended or
 * it was abandoned) and must go (docs/FLAGS.md, "Removing a flag"). A cleanup pass starts from the same list.
 *
 * The forms it recognizes, in product code (specs and test helpers are skipped: they test undeclared keys on
 * purpose): `useFlag('key')`, `sessionFlag(session, 'key')`, `.evaluate('key', …)` and `flags['key']`.
 */
const ASKS = [
    /\buseFlag\(\s*['"]([^'"]+)['"]/g,
    /\bsessionFlag\([^,()]+,\s*['"]([^'"]+)['"]/g,
    /\.evaluate\(\s*['"]([^'"]+)['"]/g,
    /\bflags\[\s*['"]([^'"]+)['"]\s*\]/g,
];

function productFiles(): string[] {
    return workspacePackages()
        .filter((pkg) => pkg.name !== '@app/contracts')
        .flatMap((pkg) => sourceFiles(path.join(pkg.dir, 'src')))
        .filter((file) => !/\.spec\.tsx?$/.test(file) && !file.split(path.sep).includes('testing'));
}

describe('feature flags', () => {
    const asked = productFiles().flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return ASKS.flatMap((pattern) =>
            [...source.matchAll(pattern)].map((match) => ({
                key: match[1],
                file: path.relative(REPO_ROOT, file),
            })),
        );
    });

    it('are asked for somewhere (the scan works)', () => {
        expect(asked.length).toBeGreaterThan(0);
    });

    it('are asked for only by declared keys', () => {
        expect(asked.filter(({ key }) => !isFlagKey(key))).toEqual([]);
    });

    it('are all still in use: a declared flag nothing reads is stale and must be removed', () => {
        const used = new Set(asked.map(({ key }) => key));
        expect(FLAG_KEYS.filter((key) => !used.has(key))).toEqual([]);
    });
});
