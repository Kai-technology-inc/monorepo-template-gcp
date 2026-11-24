import { Module } from '@nestjs/common';
import { FlagsAdminController } from '../flags/flags-admin.controller';
import { FlagsAdminService } from '../flags/flags-admin.service';
import { createHealthController } from '../health/health.controller';
import { SessionModule } from '../session/session.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/**
 * The `workspaces` Function: workspaces, members, invitations, and operating feature flags. The health controller
 * is listed first so that `GET /health` is matched before any `/:workspaceId` route.
 */
@Module({
    imports: [SessionModule],
    controllers: [
        createHealthController('workspaces'),
        WorkspacesController,
        MembersController,
        InvitationsController,
        FlagsAdminController,
    ],
    providers: [WorkspacesService, MembersService, InvitationsService, FlagsAdminService],
})
export class WorkspacesModule {}
