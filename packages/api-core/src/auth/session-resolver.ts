import { Injectable } from '@nestjs/common';
import {
    MemberSchema,
    permissionsOf,
    UserProfileSchema,
    type Member,
    type UserProfile,
} from '@app/contracts';
import { AppError } from '../http/app-error';
import { paths } from '../persistence/paths';
import { parseDocument, Store } from '../persistence/store';
import type { AuthContext, Identity } from './auth-context';

/**
 * From a verified identity to an `AuthContext`: two reads (the profile and one membership).
 *
 * `workspaceId` is the route's when it has one (and then membership is required unless `optionalMembership`), the
 * active workspace otherwise. Membership is read from Firestore on every request on purpose: a removed member loses
 * access on their next request, not when their token expires.
 */
@Injectable()
export class SessionResolver {
    constructor(private readonly store: Store) {}

    async resolve(
        identity: Identity,
        routeWorkspaceId: string | undefined,
        optionalMembership = false,
    ): Promise<AuthContext> {
        const user = await this.readUser(identity.userId);
        if (!user) throw new AppError('NOT_REGISTERED', 403, 'The account has no profile yet');
        const workspaceId = routeWorkspaceId ?? user.activeWorkspaceId;
        const member = workspaceId ? await this.readMember(workspaceId, identity.userId) : null;
        if (routeWorkspaceId && !member && !optionalMembership) {
            throw new AppError('NOT_A_MEMBER', 403, 'Not a member of this workspace');
        }
        const role = member?.role ?? null;
        return {
            ...identity,
            user,
            workspaceId: workspaceId ?? null,
            role,
            permissions: permissionsOf(role),
        };
    }

    async readUser(userId: string): Promise<UserProfile | null> {
        const path = paths.user(userId);
        const data = await this.store.get(path);
        return data ? parseDocument(UserProfileSchema, data, path) : null;
    }

    async readMember(workspaceId: string, userId: string): Promise<Member | null> {
        const path = paths.member(workspaceId, userId);
        const data = await this.store.get(path);
        return data ? parseDocument(MemberSchema, data, path) : null;
    }
}
