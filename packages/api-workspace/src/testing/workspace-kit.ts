import type { AuthContext, Identity } from '@app/api-core/auth/auth-context';
import { SessionResolver } from '@app/api-core/auth/session-resolver';
import { FirestoreFlagsProvider } from '@app/api-core/flags/firestore/firestore-flags-provider';
import { InMemoryStore } from '@app/api-core/testing/in-memory-store';
import { identity } from '@app/api-core/testing/identities';
import { fixedClock } from '@app/api-core/time/clock';
import { AccountService } from '../account/account.service';
import { FlagsAdminService } from '../flags/flags-admin.service';
import { SessionService } from '../session/session.service';
import { InvitationsService } from '../workspaces/invitations.service';
import { MembersService } from '../workspaces/members.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

/**
 * Every service of this package over one in-memory store and one fixed clock, as the specs use them. Flags are the
 * own provider over the same store (what `FLAGS_PROVIDER=firestore` runs), so a spec can set a rule and read the
 * session.
 */
export function createKit(now = '2026-01-01T00:00:00.000Z') {
    const store = new InMemoryStore();
    const clock = fixedClock(now);
    const resolver = new SessionResolver(store);
    const flags = new FirestoreFlagsProvider(store, { clock, cacheMs: 0 });
    const sessions = new SessionService(store, resolver, flags);
    const kit = {
        store,
        clock,
        flags,
        sessions,
        flagsAdmin: new FlagsAdminService(flags),
        account: new AccountService(store, sessions, clock),
        workspaces: new WorkspacesService(store, sessions, clock),
        members: new MembersService(store),
        invitations: new InvitationsService(store, sessions, clock),
        /** The `AuthContext` the guard would build for this person on a route of `workspaceId`. */
        auth: (who: Identity, workspaceId?: string): Promise<AuthContext> =>
            resolver.resolve(who, workspaceId, true),
        /** Registers a person, with a workspace when `workspaceName` is given. */
        register: async (userId: string, workspaceName?: string) => {
            const who = identity(userId);
            const session = await kit.account.register(who, {
                displayName: userId.toUpperCase(),
                locale: 'en',
                ...(workspaceName ? { workspaceName } : {}),
            });
            return { who, session };
        },
        /** Invites `userId` to `workspaceId` and accepts, returning the new member's identity. */
        join: async (
            owner: Identity,
            workspaceId: string,
            userId: string,
            role: 'ADMIN' | 'MEMBER' = 'MEMBER',
        ) => {
            const { invitation, acceptPath } = await kit.invitations.create(
                await kit.auth(owner, workspaceId),
                workspaceId,
                {
                    email: `${userId}@example.com`,
                    role,
                },
            );
            const token = new URLSearchParams(acceptPath.split('?')[1]).get('token') as string;
            const { who } = await kit.register(userId);
            await kit.invitations.accept(
                await kit.auth(who, workspaceId),
                workspaceId,
                invitation.id,
                token,
            );
            return who;
        },
    };
    return kit;
}
