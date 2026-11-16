import { Inject, Injectable } from '@nestjs/common';
import type {
    RegisterRequest,
    Session,
    SwitchWorkspaceRequest,
    UpdateProfileRequest,
    UserProfile,
} from '@app/contracts';
import type { AuthContext, Identity } from '@app/api-core/auth/auth-context';
import { AppError } from '@app/api-core/http/app-error';
import { MEMBERS_COLLECTION, paths } from '@app/api-core/persistence/paths';
import { Store, where } from '@app/api-core/persistence/store';
import { CLOCK, type Clock } from '@app/api-core/time/clock';
import { SessionService } from '../session/session.service';
import { allocateSlug, writeWorkspace } from '../workspaces/workspace-writer';

@Injectable()
export class AccountService {
    constructor(
        private readonly store: Store,
        private readonly sessions: SessionService,
        @Inject(CLOCK) private readonly clock: Clock,
    ) {}

    /**
     * Creates the profile of a Firebase identity and, with `workspaceName`, its first workspace (as `OWNER`, made
     * active). Without it the person arrives through an invitation and has no workspace yet.
     */
    async register(identity: Identity, request: RegisterRequest): Promise<Session> {
        const now = this.clock.now().toISOString();
        await this.store.runTransaction(async (tx) => {
            if (await tx.get(paths.user(identity.userId))) {
                throw new AppError('ALREADY_REGISTERED', 409, 'This account already has a profile');
            }
            const slug = request.workspaceName
                ? await allocateSlug(tx, request.workspaceName, undefined, () =>
                      this.store.newId().slice(0, 6).toLowerCase(),
                  )
                : null;

            let activeWorkspaceId: string | null = null;
            if (request.workspaceName && slug) {
                activeWorkspaceId = writeWorkspace(tx, {
                    workspaceId: this.store.newId(),
                    name: request.workspaceName,
                    slug,
                    owner: {
                        userId: identity.userId,
                        email: identity.email,
                        displayName: request.displayName,
                    },
                    now,
                }).id;
            }
            const user: UserProfile = {
                id: identity.userId,
                email: identity.email,
                displayName: request.displayName,
                locale: request.locale,
                activeWorkspaceId,
                createdAt: now,
                updatedAt: now,
            };
            tx.create(paths.user(identity.userId), { ...user });
        });
        return this.sessions.build(identity);
    }

    /**
     * Updates the profile. The display name is copied into every membership (`members/{u}.displayName`), in the same
     * transaction, so member lists never show a stale name.
     */
    async updateProfile(auth: AuthContext, request: UpdateProfileRequest): Promise<Session> {
        const now = this.clock.now().toISOString();
        await this.store.runTransaction(async (tx) => {
            const memberships =
                request.displayName !== undefined
                    ? await tx.collectionGroup(MEMBERS_COLLECTION, [
                          where('userId', '==', auth.userId),
                      ])
                    : [];
            tx.update(paths.user(auth.userId), {
                ...(request.displayName !== undefined ? { displayName: request.displayName } : {}),
                ...(request.locale !== undefined ? { locale: request.locale } : {}),
                updatedAt: now,
            });
            for (const membership of memberships) {
                tx.update(membership.path, { displayName: request.displayName });
            }
        });
        return this.sessions.build(auth);
    }

    async switchActiveWorkspace(
        auth: AuthContext,
        request: SwitchWorkspaceRequest,
    ): Promise<Session> {
        const now = this.clock.now().toISOString();
        await this.store.runTransaction(async (tx) => {
            if (!(await tx.get(paths.member(request.workspaceId, auth.userId)))) {
                throw new AppError('NOT_A_MEMBER', 403, 'Not a member of this workspace');
            }
            tx.update(paths.user(auth.userId), {
                activeWorkspaceId: request.workspaceId,
                updatedAt: now,
            });
        });
        return this.sessions.build(auth);
    }
}
