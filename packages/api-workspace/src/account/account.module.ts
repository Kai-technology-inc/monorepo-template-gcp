import { Module } from '@nestjs/common';
import { createHealthController } from '../health/health.controller';
import { SessionModule } from '../session/session.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/** The `account` Function: registration, session, profile and active workspace. */
@Module({
    imports: [SessionModule],
    controllers: [AccountController, createHealthController('account')],
    providers: [AccountService],
})
export class AccountModule {}
