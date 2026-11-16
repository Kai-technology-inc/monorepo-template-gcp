import { describe, expect, it, vi } from 'vitest';

const cookieValue = vi.hoisted(() => ({
    locale: undefined as string | undefined,
    accept: null as string | null,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => (cookieValue.locale ? { value: cookieValue.locale } : undefined),
    }),
    headers: async () => ({ get: () => cookieValue.accept }),
}));
vi.mock('react', async (original) => ({
    ...(await original<typeof import('react')>()),
    cache: <T>(fn: T) => fn,
}));

const { getI18n, getLocale } = await import('./server');

describe('getLocale', () => {
    it('prefers the cookie', async () => {
        cookieValue.locale = 'pt';
        cookieValue.accept = 'es-AR';
        expect(await getLocale()).toBe('pt');
    });

    it('ignores an unsupported cookie and negotiates Accept-Language', async () => {
        cookieValue.locale = 'fr';
        cookieValue.accept = 'es-AR,es;q=0.9';
        expect(await getLocale()).toBe('es');
    });

    it('falls back to English', async () => {
        cookieValue.locale = undefined;
        cookieValue.accept = null;
        expect(await getLocale()).toBe('en');
    });
});

describe('getI18n', () => {
    it('translates in the request language', async () => {
        cookieValue.locale = 'es';
        const { t } = await getI18n();
        expect(t('auth.login.title')).toBe('Iniciar sesión');
    });
});
