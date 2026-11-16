import { describe, expect, it } from 'vitest';
import { localeCookieString, readLocaleCookie } from './locale-cookie';

describe('locale cookie', () => {
    it('reads a supported locale', () => {
        expect(readLocaleCookie('a=1; app-locale=es; b=2')).toBe('es');
    });

    it('ignores unsupported or missing values', () => {
        expect(readLocaleCookie('app-locale=fr')).toBeNull();
        expect(readLocaleCookie('')).toBeNull();
        expect(readLocaleCookie(undefined)).toBeNull();
    });

    it('writes a site-wide, long-lived cookie', () => {
        expect(localeCookieString('pt')).toMatch(
            /^app-locale=pt; Path=\/; Max-Age=\d+; SameSite=Lax$/,
        );
    });
});
