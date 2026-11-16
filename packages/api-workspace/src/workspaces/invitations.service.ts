import { Inject, Injectable } from '@nestjs/common';
import {
    INVITATION_TTL_DAYS,
    InvitationSchema,
    WorkspaceSchema,
    type CreateInvitationRequest,
    type CreateInvitationResponse,
    type Invitation,
    type InvitationPreview,
    type Session,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { AppError, notFound } from '@app/api-core/http/app-error';
import { paths } from '@app/api-core/persistence/paths';
import { parseDocument, Store, where, type StoreReader } from '@app/api-core/persistence/store';
import { CLOCK, type Clock } from '@app/api-core/time/clock';
import { InvitationRecordSchema, type InvitationRecord, type MemberRecord } from '../records';
import { SessionService } from '../session/session.service';
import {
    hashInvitationToken,
    matchesInvitationToken,
    newInvitationToken,
} from './invitation-token';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * INVITATIONS BY LINK
 *
 * Creating one returns `acceptPath`, a path on the web with the secret token; the inviter shares it. The template
 * sends no email: to send it, call your provider at the end of `create()` with the absolute link (and stop returning
 * the path if you prefer). The token is never stored, only its SHA-256.
 */
@Injectable()
export class InvitationsService {
    constructor(
        private readonly store: Store,
        private readonly sessions: SessionService,
        @Inject(CLOCK) private readonly clock: Clock,
    ) {}

    /** Pending, unexpired invitations, newest first. */
    async list(workspaceId: string): Promise<Invitation[]> {
        const now = this.clock.now().toISOString();
        const docs = await this.store.query(paths.invitations(workspaceId), [
            where('status', '==', 'PENDING'),
        ]);
        return docs
            .map((doc) => parseDocument(InvitationSchema, doc.data, doc.path))
            .filter((invitation) => invitation.expiresAt > now)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /** Creates an invitation, revoking any pending one for the same email. */
    async create(
        auth: AuthContext,
        workspaceId: string,
        request: CreateInvitationRequest,
    ): Promise<CreateInvitationResponse> {
        const now = this.clock.now();
        const token = newInvitationToken();
        const invitation = await this.store.runTransaction(async (tx) => {
            const workspacePath = paths.workspace(workspaceId);
            const workspaceData = await tx.get(workspacePath);
            if (!workspaceData) throw notFound('Workspace not found');
            const workspace = parseDocument(WorkspaceSchema, workspaceData, workspacePath);
            const existingMembers = await tx.query(
                paths.members(workspaceId),
                [where('email', '==', request.email)],
                {
                    limit: 1,
                },
            );
            if (existingMembers.length > 0) {
                throw new AppError(
                    'ALREADY_A_MEMBER',
                    409,
                    'That email already belongs to a member',
                );
            }
            const pending = await tx.query(paths.invitations(workspaceId), [
                where('email', '==', request.email),
                where('status', '==', 'PENDING'),
            ]);

            for (const doc of pending) tx.update(doc.path, { status: 'REVOKED' });
            const record: InvitationRecord = {
                id: this.store.newId(),
                workspaceId,
                workspaceName: workspace.name,
                email: request.email,
                role: request.role,
                status: 'PENDING',
                invitedBy: auth.userId,
                createdAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS).toISOString(),
                tokenHash: hashInvitationToken(token),
                acceptedBy: null,
                acceptedAt: null,
            };
            tx.create(paths.invitation(workspaceId, record.id), { ...record });
            return InvitationSchema.parse(record);
        });
        const query = new URLSearchParams({
            workspace: workspaceId,
            invitation: invitation.id,
            token,
        });
        return { invitation, acceptPath: `/auth/invitations/accept?${query.toString()}` };
    }

    async revoke(workspaceId: string, invitationId: string): Promise<void> {
        const path = paths.invitation(workspaceId, invitationId);
        await this.store.runTransaction(async (tx) => {
            const data = await tx.get(path);
            if (!data || data.status !== 'PENDING') throw notFound('Invitation not found');
            tx.update(path, { status: 'REVOKED' });
        });
    }

    /** What the accept screen shows before sign-in. Requires the token, so ids alone reveal nothing. */
    async preview(
        workspaceId: string,
        invitationId: string,
        token: string,
    ): Promise<InvitationPreview> {
        const invitation = await this.readValid(this.store, workspaceId, invitationId, token);
        return {
            workspaceName: invitation.workspaceName,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
        };
    }

    /** Joins the caller to the workspace, marks the invitation accepted and makes the workspace active. */
    async accept(
        auth: AuthContext,
        workspaceId: string,
        invitationId: string,
        token: string,
    ): Promise<Session> {
        const now = this.clock.now().toISOString();
        await this.store.runTransaction(async (tx) => {
            const invitation = await this.readValid(tx, workspaceId, invitationId, token);
            if (invitation.email !== auth.email) {
                throw new AppError(
                    'INVITATION_EMAIL_MISMATCH',
                    403,
                    'The invitation is for a different email',
                );
            }
            if (await tx.get(paths.member(workspaceId, auth.userId))) {
                throw new AppError('ALREADY_A_MEMBER', 409, 'Already a member of this workspace');
            }
            const member: MemberRecord = {
                userId: auth.userId,
                workspaceId,
                email: auth.email,
                displayName: auth.user.displayName,
                role: invitation.role,
                joinedAt: now,
            };
            tx.create(paths.member(workspaceId, auth.userId), { ...member });
            tx.update(paths.invitation(workspaceId, invitationId), {
                status: 'ACCEPTED',
                acceptedBy: auth.userId,
                acceptedAt: now,
            });
            tx.update(paths.user(auth.userId), { activeWorkspaceId: workspaceId, updatedAt: now });
        });
        return this.sessions.build(auth);
    }

    private async readValid(
        reader: StoreReader,
        workspaceId: string,
        invitationId: string,
        token: string,
    ): Promise<InvitationRecord> {
        const path = paths.invitation(workspaceId, invitationId);
        const data = await reader.get(path);
        const invitation = data ? parseDocument(InvitationRecordSchema, data, path) : null;
        if (
            !invitation ||
            invitation.status !== 'PENDING' ||
            !matchesInvitationToken(token, invitation.tokenHash)
        ) {
            throw new AppError(
                'INVITATION_INVALID',
                404,
                'Invitation not found or no longer valid',
            );
        }
        if (invitation.expiresAt <= this.clock.now().toISOString()) {
            throw new AppError('INVITATION_EXPIRED', 410, 'Invitation expired');
        }
        return invitation;
    }
}
