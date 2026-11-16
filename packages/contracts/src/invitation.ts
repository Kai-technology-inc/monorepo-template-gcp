import { z } from 'zod';
import { EmailSchema, IdSchema, IsoDateTimeSchema } from './primitives';
import { InvitableRoleSchema } from './roles';

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REVOKED'] as const;
export const InvitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

/** How long an invitation link stays valid. */
export const INVITATION_TTL_DAYS = 7;

/**
 * `workspaces/{workspaceId}/invitations/{invitationId}`. The secret token is never stored: only its hash
 * (`tokenHash`, server-side only, not part of this public schema).
 */
export const InvitationSchema = z.object({
    id: IdSchema,
    workspaceId: IdSchema,
    workspaceName: z.string(),
    email: EmailSchema,
    role: InvitableRoleSchema,
    status: InvitationStatusSchema,
    invitedBy: IdSchema,
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
});
export type Invitation = z.infer<typeof InvitationSchema>;

export const CreateInvitationRequestSchema = z
    .object({ email: EmailSchema, role: InvitableRoleSchema })
    .strict();
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;

/**
 * The link is returned once, to whoever invited. The template does not send email: wire your provider in
 * `InvitationsService` (see docs/EXTENDING.md) and stop returning it if you prefer.
 */
export const CreateInvitationResponseSchema = z.object({
    invitation: InvitationSchema,
    acceptPath: z.string(),
});
export type CreateInvitationResponse = z.infer<typeof CreateInvitationResponseSchema>;

export const InvitationListResponseSchema = z.object({ invitations: z.array(InvitationSchema) });
export type InvitationListResponse = z.infer<typeof InvitationListResponseSchema>;

export const AcceptInvitationRequestSchema = z
    .object({ token: z.string().min(20).max(200) })
    .strict();
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

/** What the accept screen can show before signing in: nothing secret, only what the link already implies. */
export const InvitationPreviewSchema = z.object({
    workspaceName: z.string(),
    email: EmailSchema,
    role: InvitableRoleSchema,
    expiresAt: IsoDateTimeSchema,
});
export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;
