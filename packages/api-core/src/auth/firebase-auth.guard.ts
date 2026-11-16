import { Injectable, Logger, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@app/contracts';
import { requiresVerifiedEmail } from '../config/environment';
import { IdTokenVerifier } from '../firebase/firebase-admin.module';
import { AppError } from '../http/app-error';
import type { AuthenticatedRequest, Identity } from './auth-context';
import {
    ALLOW_UNVERIFIED_EMAIL_METADATA,
    IDENTITY_ONLY_METADATA,
    OUTSIDE_WORKSPACE_METADATA,
    PERMISSION_METADATA,
    PUBLIC_METADATA,
} from './decorators';
import { SessionResolver } from './session-resolver';

/**
 * THE ONE GUARD, ON EVERY ROUTE
 *
 * Registered as `APP_GUARD`, so a new route is protected by default and opting out is explicit (`@Public()`). In
 * order: verify the Firebase ID token → `@IdentityOnly()` stops here → verified email (unless
 * `@AllowUnverifiedEmail()` or disabled by configuration) → profile and membership → `@RequirePermission(...)`.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    private readonly logger = new Logger(FirebaseAuthGuard.name);

    constructor(
        private readonly verifier: IdTokenVerifier,
        private readonly sessions: SessionResolver,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        if (request.method === 'OPTIONS') return true;
        if (this.flag(context, PUBLIC_METADATA)) return true;

        const identity = await this.verify(request.headers.authorization);
        request.identity = identity;
        if (this.flag(context, IDENTITY_ONLY_METADATA)) return true;

        if (
            requiresVerifiedEmail() &&
            !identity.emailVerified &&
            !this.flag(context, ALLOW_UNVERIFIED_EMAIL_METADATA)
        ) {
            throw new AppError(
                'EMAIL_NOT_VERIFIED',
                403,
                'The email of this account is not verified',
            );
        }

        const params = request.params as Record<string, string | undefined> | undefined;
        const outside = this.flag(context, OUTSIDE_WORKSPACE_METADATA);
        request.auth = await this.sessions.resolve(identity, params?.workspaceId, outside);

        const permission = this.reflector.getAllAndOverride<Permission | undefined>(
            PERMISSION_METADATA,
            [context.getHandler(), context.getClass()],
        );
        if (permission && !hasPermission(request.auth.role, permission)) {
            throw new AppError('FORBIDDEN', 403, `Missing permission ${permission}`);
        }
        return true;
    }

    private async verify(authorization: string | undefined): Promise<Identity> {
        const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
        if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 401, 'Missing bearer token');
        try {
            const token = await this.verifier.verifyIdToken(match[1].trim());
            if (!token.email)
                throw new AppError('UNAUTHENTICATED', 401, 'The identity has no email');
            return {
                userId: token.uid,
                email: token.email.toLowerCase(),
                displayName: token.name ?? null,
                emailVerified: token.email_verified === true,
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            const code = (error as { code?: unknown } | null)?.code;
            this.logger.warn(`Token rejected: ${typeof code === 'string' ? code : 'unknown'}`);
            throw new AppError('UNAUTHENTICATED', 401, 'Invalid session');
        }
    }

    private flag(context: ExecutionContext, key: string): boolean {
        return (
            this.reflector.getAllAndOverride<boolean>(key, [
                context.getHandler(),
                context.getClass(),
            ]) === true
        );
    }
}
