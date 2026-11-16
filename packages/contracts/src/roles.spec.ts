import { describe, expect, it } from '@jest/globals';
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

    it('grants nothing without a role', () => {
        expect(hasPermission(null, 'workspace:read')).toBe(false);
    });
});
