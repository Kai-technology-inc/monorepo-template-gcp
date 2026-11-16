import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@app/contracts';
import type { AuthContext, AuthenticatedRequest, Identity } from './auth-context';

export const PUBLIC_METADATA = 'auth:public';
export const IDENTITY_ONLY_METADATA = 'auth:identity-only';
export const ALLOW_UNVERIFIED_EMAIL_METADATA = 'auth:allow-unverified-email';
export const OUTSIDE_WORKSPACE_METADATA = 'auth:outside-workspace';
export const PERMISSION_METADATA = 'auth:permission';

/** No token needed. Use for health checks and for what a link must show before sign-in. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_METADATA, true);

/** A valid token is enough; the profile may not exist yet (registration). Inject it with `@CurrentIdentity()`. */
export const IdentityOnly = (): MethodDecorator & ClassDecorator =>
    SetMetadata(IDENTITY_ONLY_METADATA, true);

/** Reachable before the email is verified, so the web can render the verification screen. */
export const AllowUnverifiedEmail = (): MethodDecorator & ClassDecorator =>
    SetMetadata(ALLOW_UNVERIFIED_EMAIL_METADATA, true);

/**
 * The route has a `:workspaceId` but the caller is not expected to be a member yet (accepting an invitation):
 * the guard does not require a membership there.
 */
export const OutsideWorkspace = (): MethodDecorator & ClassDecorator =>
    SetMetadata(OUTSIDE_WORKSPACE_METADATA, true);

/** The caller's role in the route's workspace must grant this permission (`ROLE_PERMISSIONS`). */
export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
    SetMetadata(PERMISSION_METADATA, permission);

export const CurrentAuth = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthContext => {
        const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
        if (!auth)
            throw new Error(
                '@CurrentAuth() used on a route without a session (is it @Public or @IdentityOnly?)',
            );
        return auth;
    },
);

export const CurrentIdentity = createParamDecorator(
    (_data: unknown, context: ExecutionContext): Identity => {
        const identity = context.switchToHttp().getRequest<AuthenticatedRequest>().identity;
        if (!identity) throw new Error('@CurrentIdentity() used on a @Public route');
        return identity;
    },
);
