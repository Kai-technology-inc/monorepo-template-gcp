import type { Request } from 'express';
import type { Permission, UserProfile, WorkspaceRole } from '@app/contracts';

/** Who is calling, from the verified token alone. Available on every authenticated route. */
export interface Identity {
    readonly userId: string;
    readonly email: string;
    readonly displayName: string | null;
    readonly emailVerified: boolean;
}

/**
 * Who is calling and from where: the identity, their profile, and their role in the workspace this request is
 * about (the `:workspaceId` of the route, or their active workspace). `role` is `null` when there is no such
 * workspace or they are not a member of their stale active one.
 */
export interface AuthContext extends Identity {
    readonly user: UserProfile;
    readonly workspaceId: string | null;
    readonly role: WorkspaceRole | null;
    readonly permissions: readonly Permission[];
}

export interface AuthenticatedRequest extends Request {
    requestId?: string;
    identity?: Identity;
    auth?: AuthContext;
}
