import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '@app/contracts';
import { aMember } from './fixtures';
import { assignableRoles, canChangeRole, canRemove, sortMembers, type Actor } from './member-rules';

const owner: Actor = { userId: 'o', role: 'OWNER', permissions: ROLE_PERMISSIONS.OWNER };
const admin: Actor = { userId: 'a', role: 'ADMIN', permissions: ROLE_PERMISSIONS.ADMIN };
const member: Actor = { userId: 'm', role: 'MEMBER', permissions: ROLE_PERMISSIONS.MEMBER };

describe('member rules', () => {
    it('only owners hand out ownership', () => {
        expect(assignableRoles('OWNER')).toContain('OWNER');
        expect(assignableRoles('ADMIN')).toEqual(['ADMIN', 'MEMBER']);
        expect(assignableRoles('MEMBER')).toEqual([]);
    });

    it('nobody changes their own role or removes themselves here', () => {
        const self = aMember({ userId: 'o', role: 'OWNER' });
        expect(canChangeRole(owner, self)).toBe(false);
        expect(canRemove(owner, self)).toBe(false);
    });

    it('admins cannot touch owners', () => {
        const anOwner = aMember({ role: 'OWNER' });
        expect(canChangeRole(admin, anOwner)).toBe(false);
        expect(canRemove(admin, anOwner)).toBe(false);
        expect(canChangeRole(owner, anOwner)).toBe(true);
        expect(canChangeRole(admin, aMember())).toBe(true);
    });

    it('members manage nobody', () => {
        expect(canChangeRole(member, aMember())).toBe(false);
        expect(canRemove(member, aMember())).toBe(false);
    });

    it('sorts by role, then name', () => {
        const sorted = sortMembers([
            aMember({ userId: '1', displayName: 'Zed', role: 'MEMBER' }),
            aMember({ userId: '2', displayName: 'Bea', role: 'ADMIN' }),
            aMember({ userId: '3', displayName: 'Al', role: 'MEMBER' }),
            aMember({ userId: '4', displayName: 'Yu', role: 'OWNER' }),
        ]);
        expect(sorted.map((m) => m.displayName)).toEqual(['Yu', 'Bea', 'Al', 'Zed']);
    });
});
