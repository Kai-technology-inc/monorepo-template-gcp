import { describe, expect, it } from 'vitest';
import { paths } from './paths';

describe('paths', () => {
    it('builds paths from ids', () => {
        expect(paths.member('w1', 'u1')).toBe('workspaces/w1/members/u1');
    });

    it('refuses ids that would change the path', () => {
        for (const id of ['a/members/x', '', '..', '__name__']) {
            expect(() => paths.workspace(id)).toThrow(
                expect.objectContaining({ code: 'NOT_FOUND' }),
            );
        }
    });
});
