import { Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';
import {
    UpdateMemberRoleRequestSchema,
    type Member,
    type MemberListResponse,
    type UpdateMemberRoleRequest,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { CurrentAuth, RequirePermission } from '@app/api-core/auth/decorators';
import { ZodBody } from '@app/api-core/http/zod.pipe';
import { MembersService } from './members.service';

/** `/workspaces/:workspaceId/members` (docs/API.md, "Workspaces"). */
@Controller(':workspaceId/members')
export class MembersController {
    constructor(private readonly members: MembersService) {}

    @RequirePermission('members:read')
    @Get()
    async list(@Param('workspaceId') workspaceId: string): Promise<MemberListResponse> {
        return { members: await this.members.list(workspaceId) };
    }

    @RequirePermission('members:manage')
    @Patch(':userId')
    changeRole(
        @CurrentAuth() auth: AuthContext,
        @Param('workspaceId') workspaceId: string,
        @Param('userId') userId: string,
        @ZodBody(UpdateMemberRoleRequestSchema) body: UpdateMemberRoleRequest,
    ): Promise<Member> {
        return this.members.changeRole(auth, workspaceId, userId, body.role);
    }

    /** Needs `members:manage`, except to leave (the caller's own id): checked in the service. */
    @Delete(':userId')
    @HttpCode(204)
    remove(
        @CurrentAuth() auth: AuthContext,
        @Param('workspaceId') workspaceId: string,
        @Param('userId') userId: string,
    ): Promise<void> {
        return this.members.remove(auth, workspaceId, userId);
    }
}
