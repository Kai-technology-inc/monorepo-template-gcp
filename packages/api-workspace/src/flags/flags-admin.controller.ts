import { Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import {
    SetFlagRuleRequestSchema,
    type FlagListResponse,
    type FlagRule,
    type FlagState,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { CurrentAuth, RequirePermission } from '@app/api-core/auth/decorators';
import { ZodBody } from '@app/api-core/http/zod.pipe';
import { FlagsAdminService } from './flags-admin.service';

/** `/workspaces/:workspaceId/flags` (docs/API.md, "Feature flags"). Owners and admins of the operator workspace. */
@RequirePermission('flags:manage')
@Controller(':workspaceId/flags')
export class FlagsAdminController {
    constructor(private readonly flags: FlagsAdminService) {}

    @Get()
    list(@Param('workspaceId') workspaceId: string): Promise<FlagListResponse> {
        return this.flags.list(workspaceId);
    }

    @Get(':flagKey')
    read(
        @Param('workspaceId') workspaceId: string,
        @Param('flagKey') flagKey: string,
    ): Promise<FlagState> {
        return this.flags.read(workspaceId, flagKey);
    }

    @Put(':flagKey')
    set(
        @CurrentAuth() auth: AuthContext,
        @Param('workspaceId') workspaceId: string,
        @Param('flagKey') flagKey: string,
        @ZodBody(SetFlagRuleRequestSchema) body: FlagRule,
    ): Promise<FlagState> {
        return this.flags.set(auth, workspaceId, flagKey, body);
    }

    @Delete(':flagKey')
    @HttpCode(204)
    turnOff(
        @Param('workspaceId') workspaceId: string,
        @Param('flagKey') flagKey: string,
    ): Promise<void> {
        return this.flags.turnOff(workspaceId, flagKey);
    }
}
