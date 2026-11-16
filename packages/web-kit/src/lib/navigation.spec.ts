import { describe, expect, it } from 'vitest';
import { invalidWebSegments } from '@app/contracts';
import { ROUTES, safeNextPath, withNext } from './navigation';

describe('safeNextPath', () => {
    it('keeps paths on this site', () => {
        expect(safeNextPath('/members?x=1')).toBe('/members?x=1');
    });

    it('drops anything that could leave the site', () => {
        for (const next of [
            'https://evil.example',
            '//evil.example',
            '/\\evil.example',
            'members',
            '',
            null,
        ]) {
            expect(safeNextPath(next)).toBe('/dashboard');
        }
    });
});

describe('withNext', () => {
    it('appends the encoded return path', () => {
        expect(withNext('/auth/login', '/auth/invitations/accept?token=a&b=c')).toBe(
            '/auth/login?next=%2Fauth%2Finvitations%2Faccept%3Ftoken%3Da%26b%3Dc',
        );
        expect(withNext('/auth/login', null)).toBe('/auth/login');
    });
});

describe('ROUTES', () => {
    it('uses the URL vocabulary', () => {
        for (const path of Object.values(ROUTES)) expect(invalidWebSegments(path)).toEqual([]);
    });
});
