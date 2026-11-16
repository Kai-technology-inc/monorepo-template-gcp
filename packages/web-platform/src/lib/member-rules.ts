import type { Member, Permission, WorkspaceRole } from '@app/contracts';

/**
 * WHAT THE MEMBERS SCREEN OFFERS
 *
 * The API enforces every one of these rules; the screen mirrors them so it never offers an action that would be
 * refused. Only an owner hands out or takes away ownership, nobody changes their own role, and an admin cannot
 * touch an owner.
 */
export interface Actor {
    readonly userId: string;
    readonly role: WorkspaceRole | null;
    readonly permissions: readonly Permission[];
}

export function assignableRoles(actorRole: WorkspaceRole | null): readonly WorkspaceRole[] {
    if (actorRole === 'OWNER') return ['OWNER', 'ADMIN', 'MEMBER'];
    if (actorRole === 'ADMIN') return ['ADMIN', 'MEMBER'];
    return [];
}

function managesTarget(actor: Actor, target: Member): boolean {
    return (
        actor.permissions.includes('members:manage') &&
        target.userId !== actor.userId &&
        (target.role !== 'OWNER' || actor.role === 'OWNER')
    );
}

export function canChangeRole(actor: Actor, target: Member): boolean {
    return managesTarget(actor, target);
}

export function canRemove(actor: Actor, target: Member): boolean {
    return managesTarget(actor, target);
}

/** Owners first, then admins, then members; alphabetical inside each group. */
export function sortMembers(members: readonly Member[]): Member[] {
    const rank: Record<WorkspaceRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
    return [...members].sort(
        (a, b) => rank[a.role] - rank[b.role] || a.displayName.localeCompare(b.displayName),
    );
}
