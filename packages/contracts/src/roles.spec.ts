import { describe, expect, it } from 'vitest';
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from './roles';

describe('roles', () => {
    it('gives the owner every permission', () => {
        expect([...ROLE_PERMISSIONS.OWNER].sort()).toEqual([...PERMISSIONS].sort());
    });

    it('keeps members away from managing people', () => {
        expect(hasPermission('MEMBER', 'members:manage')).toBe(false);
        expect(hasPermission('MEMBER', 'invitations:manage')).toBe(false);
        expect(hasPermission('ADMIN', 'invitations:manage')).toBe(true);
    });

    it('lets owners and admins operate flags, never members', () => {
        expect(hasPermission('OWNER', 'flags:manage')).toBe(true);
        expect(hasPermission('ADMIN', 'flags:manage')).toBe(true);
        expect(hasPermission('MEMBER', 'flags:manage')).toBe(false);
    });

    it('grants nothing without a role', () => {
        expect(hasPermission(null, 'workspace:read')).toBe(false);
    });
});
