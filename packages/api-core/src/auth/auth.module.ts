import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { SessionResolver } from './session-resolver';

/** Registers the guard on every route of the app that imports it. Import it once, at the root. */
@Global()
@Module({
    providers: [SessionResolver, { provide: APP_GUARD, useClass: FirebaseAuthGuard }],
    exports: [SessionResolver],
})
export class AuthModule {}
