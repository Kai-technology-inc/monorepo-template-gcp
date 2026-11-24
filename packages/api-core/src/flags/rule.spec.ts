import { describe, expect, it } from 'vitest';
import { bucketOf } from './rule';

describe('bucketOf', () => {
    it('is stable and in [0, 100)', () => {
        expect(bucketOf('a-flag', 'u1')).toBe(bucketOf('a-flag', 'u1'));
        for (let i = 0; i < 1000; i += 1) {
            const bucket = bucketOf('a-flag', `u${i}`);
            expect(bucket).toBeGreaterThanOrEqual(0);
            expect(bucket).toBeLessThan(100);
        }
    });

    it('splits each flag differently', () => {
        const ids = Array.from({ length: 1000 }, (_, i) => `u${i}`);
        const first = ids.filter((id) => bucketOf('flag-a', id) < 10);
        const second = ids.filter((id) => bucketOf('flag-b', id) < 10);
        const both = first.filter((id) => second.includes(id));
        expect(both.length).toBeLessThan(first.length / 2);
    });
});
