import { describe, expect, it, vi } from 'vitest';
import { en } from './messages/en';
import { es } from './messages/es';
import { createTranslator } from './translator';
import type { Messages } from './types';

describe('createTranslator', () => {
    const t = createTranslator('en', en);

    it('reads a nested key', () => {
        expect(t('auth.login.title')).toBe('Sign in');
    });

    it('interpolates placeholders', () => {
        expect(t('dashboard.welcome', { name: 'Ada' })).toBe('Welcome, Ada');
    });

    it('picks the plural form and formats the count', () => {
        expect(t('members.count', { count: 1 })).toBe('1 member');
        expect(t('members.count', { count: 1234 })).toBe('1,234 members');
        expect(t('dashboard.memberCount', { count: 0 })).toBe('No members yet');
    });

    it('formats numbers with the locale', () => {
        const tes = createTranslator('es', es);
        expect(tes('members.count', { count: 1234 })).toBe('1234 miembros');
        expect(tes('members.count', { count: 12345 })).toBe('12.345 miembros');
    });

    it('falls back, reports once, and finally shows the key', () => {
        const onMissingKey = vi.fn();
        const partial = { ...es, auth: { ...es.auth, login: {} } } as unknown as Messages;
        const tPartial = createTranslator('es', partial, { fallback: en, onMissingKey });
        expect(tPartial('auth.login.title')).toBe('Sign in');
        expect(tPartial('auth.login.title')).toBe('Sign in');
        expect(onMissingKey).toHaveBeenCalledTimes(1);
        const tBare = createTranslator('es', partial);
        expect(tBare('auth.login.title')).toBe('auth.login.title');
    });

    it('leaves an unfilled placeholder visible', () => {
        const loose = t as unknown as (key: string, params?: object) => string;
        expect(loose('dashboard.welcome')).toBe('Welcome, {name}');
    });
});

// Compile-time checks: these lines must keep failing to type-check.
const typed = createTranslator('en', en);
// @ts-expect-error unknown key
typed('auth.login.tilte');
// @ts-expect-error missing required param
typed('dashboard.welcome');
// @ts-expect-error count must be a number
typed('members.count', { count: 'many' });
