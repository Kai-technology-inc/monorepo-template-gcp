import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, negotiateLocale } from './locale';

describe('negotiateLocale', () => {
    it('falls back to the default without a header', () => {
        expect(negotiateLocale(undefined)).toBe(DEFAULT_LOCALE);
        expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
    });

    it('maps a regional tag to its language', () => {
        expect(negotiateLocale('es-AR,es;q=0.9,en;q=0.8')).toBe('es');
        expect(negotiateLocale('pt-BR')).toBe('pt');
    });

    it('respects quality over order', () => {
        expect(negotiateLocale('fr;q=1, en;q=0.5, es;q=0.9')).toBe('es');
    });

    it('ignores languages that are not supported', () => {
        expect(negotiateLocale('fr, de')).toBe(DEFAULT_LOCALE);
    });
});
