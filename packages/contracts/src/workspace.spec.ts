import { describe, expect, it } from '@jest/globals';
import { slugify, WorkspaceSlugSchema } from './workspace';

describe('slugify', () => {
    it('produces a valid slug from any name', () => {
        for (const name of ['Acme Inc.', 'Café Ñandú', '  --  ', 'AB', 'x'.repeat(80)]) {
            expect(WorkspaceSlugSchema.safeParse(slugify(name)).success).toBe(true);
        }
    });

    it('strips accents and punctuation', () => {
        expect(slugify('Café Ñandú & Co.')).toBe('cafe-nandu-co');
    });
});
