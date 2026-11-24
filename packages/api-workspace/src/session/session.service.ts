import { Injectable } from '@nestjs/common';
import {
    permissionsOf,
    WorkspaceSchema,
    type MembershipSummary,
    type Session,
    type Workspace,
} from '@app/contracts';
import type { Identity } from '@app/api-core/auth/auth-context';
import { SessionResolver } from '@app/api-core/auth/session-resolver';
import { requiresVerifiedEmail } from '@app/api-core/config/environment';
import { FlagsProvider } from '@app/api-core/flags/flags-provider';
import { AppError } from '@app/api-core/http/app-error';
import { MEMBERS_COLLECTION, paths } from '@app/api-core/persistence/paths';
import { parseDocument, Store, where } from '@app/api-core/persistence/store';
import { MemberRecordSchema } from '../records';

/**
 * `Session`: what the web needs after sign-in, in one response. Every endpoint that changes what the shell shows
 * (register, switch, create, accept) answers with a fresh one, so the web never has to guess what changed. That
 * includes the feature flags, evaluated here for the person in their active workspace: switching workspace
 * re-evaluates them, and no provider SDK or key ever reaches the browser.
 */
@Injectable()
export class SessionService {
    constructor(
        private readonly store: Store,
        private readonly sessions: SessionResolver,
        private readonly flags: FlagsProvider,
    ) {}

    async build(identity: Identity): Promise<Session> {
        const user = await this.sessions.readUser(identity.userId);
        if (!user) throw new AppError('NOT_REGISTERED', 403, 'The account has no profile yet');

        const memberDocs = await this.store.collectionGroup(MEMBERS_COLLECTION, [
            where('userId', '==', identity.userId),
        ]);
        const members = memberDocs.map((doc) =>
            parseDocument(MemberRecordSchema, doc.data, doc.path),
        );
        const workspaceDocs = await this.store.getAll(
            members.map((m) => paths.workspace(m.workspaceId)),
        );

        const workspaces = new Map<string, Workspace>();
        const memberships: MembershipSummary[] = [];
        members.forEach((member, index) => {
            const data = workspaceDocs[index];
            if (!data) return;
            const workspace = parseDocument(
                WorkspaceSchema,
                data,
                paths.workspace(member.workspaceId),
            );
            workspaces.set(workspace.id, workspace);
            memberships.push({
                workspaceId: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                role: member.role,
            });
        });
        memberships.sort((a, b) => a.name.localeCompare(b.name));

        const active = user.activeWorkspaceId ? workspaces.get(user.activeWorkspaceId) : undefined;
        const role = memberships.find((m) => m.workspaceId === active?.id)?.role ?? null;
        const flags = await this.flags.evaluateAll({
            userId: user.id,
            workspaceId: active?.id ?? null,
            attributes: { locale: user.locale, ...(role ? { role } : {}) },
        });
        return {
            user,
            workspace: active ?? null,
            role,
            permissions: [...permissionsOf(role)],
            memberships,
            emailVerified: identity.emailVerified,
            emailVerificationRequired: requiresVerifiedEmail(),
            flags,
        };
    }
}
