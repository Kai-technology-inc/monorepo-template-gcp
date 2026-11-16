import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API_FUNCTIONS } from '@app/contracts';

/**
 * Every name in `API_FUNCTIONS` is exported by the codebase. Read as source on purpose: importing the index would
 * load firebase-functions, whose ESM-only dependency the test runner cannot load.
 */
describe('functions index', () => {
    const source = readFileSync(path.join(__dirname, 'index.ts'), 'utf8');

    it.each(API_FUNCTIONS)('exports %s', (name) => {
        expect(source).toMatch(
            new RegExp(`export const ${name} = createHttpFunction\\(host, '${name}'\\)`),
        );
    });
});
