import { describe, expect, it } from 'vitest';
import { createFormatters } from './formatters';

describe('createFormatters', () => {
    const date = new Date('2026-03-05T15:04:00Z');

    it('formats dates for each language', () => {
        expect(createFormatters('en', 'UTC').date(date)).toBe('Mar 5, 2026');
        expect(createFormatters('es', 'UTC').date(date)).toBe('5 mar 2026');
        expect(createFormatters('pt', 'UTC').date(date, 'short')).toBe('05/03/2026');
    });

    it('formats relative time', () => {
        const now = new Date('2026-03-06T15:04:00Z');
        expect(createFormatters('en').relativeTime(date, now)).toBe('yesterday');
        expect(createFormatters('es').relativeTime(date, now)).toBe('ayer');
    });

    it('joins lists', () => {
        expect(createFormatters('en').list(['a', 'b', 'c'])).toBe('a, b, and c');
        expect(createFormatters('es').list(['a', 'b', 'c'])).toBe('a, b y c');
    });
});
