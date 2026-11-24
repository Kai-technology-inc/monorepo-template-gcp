import { z } from 'zod';

/**
 * WHO CAN DO WHAT INSIDE A WORKSPACE
 *
 * A role is a bundle of permissions, and code checks permissions, never roles: the API with
 * `@RequirePermission(...)` and the web with `can(...)`. Adding a role or moving a permission between roles is a
 * change to this file only.
 */
export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const WorkspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

/** The roles an invitation can grant. Ownership is never handed out by link. */
export const InvitableRoleSchema = z.enum(['ADMIN', 'MEMBER']);
export type InvitableRole = z.infer<typeof InvitableRoleSchema>;

export const PERMISSIONS = [
    'workspace:read',
    'workspace:update',
    'members:read',
    'members:manage',
    'invitations:manage',
    /** Operate feature flags (own provider), only from the workspace named in `FLAGS_ADMIN_WORKSPACE_ID`. */
    'flags:manage',
] as const;
export const PermissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof PermissionSchema>;

export const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly Permission[]>> = {
    OWNER: PERMISSIONS,
    ADMIN: [
        'workspace:read',
        'workspace:update',
        'members:read',
        'members:manage',
        'invitations:manage',
        'flags:manage',
    ],
    MEMBER: ['workspace:read', 'members:read'],
};

export function permissionsOf(role: WorkspaceRole | null | undefined): readonly Permission[] {
    return role ? ROLE_PERMISSIONS[role] : [];
}

export function hasPermission(
    role: WorkspaceRole | null | undefined,
    permission: Permission,
): boolean {
    return permissionsOf(role).includes(permission);
}
