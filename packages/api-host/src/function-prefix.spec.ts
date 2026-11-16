import { describe, expect, it } from '@jest/globals';
import { stripFunctionPrefix } from './function-prefix';

describe('stripFunctionPrefix', () => {
    it('removes the function prefix and keeps the query', () => {
        expect(stripFunctionPrefix('/workspaces/w1/members?x=1', 'workspaces')).toBe(
            '/w1/members?x=1',
        );
    });

    it('maps the bare prefix to the root', () => {
        expect(stripFunctionPrefix('/workspaces', 'workspaces')).toBe('/');
        expect(stripFunctionPrefix('/workspaces?x=1', 'workspaces')).toBe('/?x=1');
    });

    it('removes a repeated prefix (emulator, rewrites)', () => {
        expect(stripFunctionPrefix('/account/account/session', 'account')).toBe('/session');
    });

    it('leaves other paths alone, including look-alikes', () => {
        expect(stripFunctionPrefix('/session', 'account')).toBe('/session');
        expect(stripFunctionPrefix('/accounts/x', 'account')).toBe('/accounts/x');
        expect(stripFunctionPrefix('session', 'account')).toBe('/session');
    });
});
