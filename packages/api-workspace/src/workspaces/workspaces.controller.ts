import { Controller, Param, Patch, Post } from '@nestjs/common';
import {
    CreateWorkspaceRequestSchema,
    UpdateWorkspaceRequestSchema,
    type CreateWorkspaceRequest,
    type Session,
    type UpdateWorkspaceRequest,
    type Workspace,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { CurrentAuth, RequirePermission } from '@app/api-core/auth/decorators';
import { ZodBody } from '@app/api-core/http/zod.pipe';
import { WorkspacesService } from './workspaces.service';

/** `/workspaces` and `/workspaces/:workspaceId` (docs/API.md, "Workspaces"). */
@Controller()
export class WorkspacesController {
    constructor(private readonly workspaces: WorkspacesService) {}

    @Post()
    create(
        @CurrentAuth() auth: AuthContext,
        @ZodBody(CreateWorkspaceRequestSchema) body: CreateWorkspaceRequest,
    ): Promise<Session> {
        return this.workspaces.create(auth, body);
    }

    @RequirePermission('workspace:update')
    @Patch(':workspaceId')
    update(
        @Param('workspaceId') workspaceId: string,
        @ZodBody(UpdateWorkspaceRequestSchema) body: UpdateWorkspaceRequest,
    ): Promise<Workspace> {
        return this.workspaces.update(workspaceId, body);
    }
}
