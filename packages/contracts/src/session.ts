import { z } from 'zod';
import { LocaleSchema } from './locale';
import { DisplayNameSchema, IdSchema } from './primitives';
import { PermissionSchema, WorkspaceRoleSchema } from './roles';
import { UserProfileSchema } from './user';
import { WorkspaceNameSchema, WorkspaceSchema } from './workspace';

export const MembershipSummarySchema = z.object({
    workspaceId: IdSchema,
    name: z.string(),
    slug: z.string(),
    role: WorkspaceRoleSchema,
});
export type MembershipSummary = z.infer<typeof MembershipSummarySchema>;

/** `GET /account/session`: everything the web needs to render the shell after sign-in, in one call. */
export const SessionSchema = z.object({
    user: UserProfileSchema,
    workspace: WorkspaceSchema.nullable(),
    role: WorkspaceRoleSchema.nullable(),
    permissions: z.array(PermissionSchema),
    memberships: z.array(MembershipSummarySchema),
    /** From the Firebase token: whether this identity proved it owns its email. */
    emailVerified: z.boolean(),
    /**
     * Whether this deployment requires a verified email for workspace routes (`AUTH_REQUIRE_VERIFIED_EMAIL`). When
     * `true` and `emailVerified` is `false`, the web shows the verification screen instead of the app.
     */
    emailVerificationRequired: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

/**
 * `POST /account/register`, called right after Firebase created the identity. Creates the profile and, unless the
 * person is joining through an invitation, their first workspace.
 */
export const RegisterRequestSchema = z
    .object({
        displayName: DisplayNameSchema,
        locale: LocaleSchema,
        workspaceName: WorkspaceNameSchema.optional(),
    })
    .strict();
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const SwitchWorkspaceRequestSchema = z.object({ workspaceId: IdSchema }).strict();
export type SwitchWorkspaceRequest = z.infer<typeof SwitchWorkspaceRequestSchema>;
