import { Controller, Get, Patch, Post, Put } from '@nestjs/common';
import {
    RegisterRequestSchema,
    SwitchWorkspaceRequestSchema,
    UpdateProfileRequestSchema,
    type RegisterRequest,
    type Session,
    type SwitchWorkspaceRequest,
    type UpdateProfileRequest,
} from '@app/contracts';
import type { AuthContext, Identity } from '@app/api-core/auth/auth-context';
import {
    AllowUnverifiedEmail,
    CurrentAuth,
    CurrentIdentity,
    IdentityOnly,
} from '@app/api-core/auth/decorators';
import { ZodBody } from '@app/api-core/http/zod.pipe';
import { SessionService } from '../session/session.service';
import { AccountService } from './account.service';

/** `/account/*` (docs/API.md, "Account"). */
@Controller()
export class AccountController {
    constructor(
        private readonly account: AccountService,
        private readonly sessions: SessionService,
    ) {}

    @IdentityOnly()
    @Post('register')
    register(
        @CurrentIdentity() identity: Identity,
        @ZodBody(RegisterRequestSchema) body: RegisterRequest,
    ): Promise<Session> {
        return this.account.register(identity, body);
    }

    @AllowUnverifiedEmail()
    @Get('session')
    session(@CurrentAuth() auth: AuthContext): Promise<Session> {
        return this.sessions.build(auth);
    }

    @AllowUnverifiedEmail()
    @Patch('profile')
    updateProfile(
        @CurrentAuth() auth: AuthContext,
        @ZodBody(UpdateProfileRequestSchema) body: UpdateProfileRequest,
    ): Promise<Session> {
        return this.account.updateProfile(auth, body);
    }

    @Put('active-workspace')
    switchWorkspace(
        @CurrentAuth() auth: AuthContext,
        @ZodBody(SwitchWorkspaceRequestSchema) body: SwitchWorkspaceRequest,
    ): Promise<Session> {
        return this.account.switchActiveWorkspace(auth, body);
    }
}
