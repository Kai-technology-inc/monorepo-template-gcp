import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import {
    AcceptInvitationRequestSchema,
    CreateInvitationRequestSchema,
    type AcceptInvitationRequest,
    type CreateInvitationRequest,
    type CreateInvitationResponse,
    type InvitationListResponse,
    type InvitationPreview,
    type Session,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import {
    CurrentAuth,
    OutsideWorkspace,
    Public,
    RequirePermission,
} from '@app/api-core/auth/decorators';
import { ZodBody, ZodQuery } from '@app/api-core/http/zod.pipe';
import { InvitationsService } from './invitations.service';

const PreviewQuerySchema = AcceptInvitationRequestSchema;
type PreviewQuery = z.infer<typeof PreviewQuerySchema>;

/** `/workspaces/:workspaceId/invitations` (docs/API.md, "Workspaces"). */
@Controller(':workspaceId/invitations')
export class InvitationsController {
    constructor(private readonly invitations: InvitationsService) {}

    @RequirePermission('invitations:manage')
    @Get()
    async list(@Param('workspaceId') workspaceId: string): Promise<InvitationListResponse> {
        return { invitations: await this.invitations.list(workspaceId) };
    }

    @RequirePermission('invitations:manage')
    @Post()
    create(
        @CurrentAuth() auth: AuthContext,
        @Param('workspaceId') workspaceId: string,
        @ZodBody(CreateInvitationRequestSchema) body: CreateInvitationRequest,
    ): Promise<CreateInvitationResponse> {
        return this.invitations.create(auth, workspaceId, body);
    }

    @RequirePermission('invitations:manage')
    @Delete(':invitationId')
    @HttpCode(204)
    revoke(
        @Param('workspaceId') workspaceId: string,
        @Param('invitationId') invitationId: string,
    ): Promise<void> {
        return this.invitations.revoke(workspaceId, invitationId);
    }

    @Public()
    @Get(':invitationId/preview')
    preview(
        @Param('workspaceId') workspaceId: string,
        @Param('invitationId') invitationId: string,
        @ZodQuery(PreviewQuerySchema) query: PreviewQuery,
    ): Promise<InvitationPreview> {
        return this.invitations.preview(workspaceId, invitationId, query.token);
    }

    @OutsideWorkspace()
    @Post(':invitationId/accept')
    @HttpCode(200)
    accept(
        @CurrentAuth() auth: AuthContext,
        @Param('workspaceId') workspaceId: string,
        @Param('invitationId') invitationId: string,
        @ZodBody(AcceptInvitationRequestSchema) body: AcceptInvitationRequest,
    ): Promise<Session> {
        return this.invitations.accept(auth, workspaceId, invitationId, body.token);
    }
}
