import { z } from 'zod';
import { IdSchema, InvitationSchema, IsoDateTimeSchema, MemberSchema } from '@app/contracts';

/**
 * WHAT IS STORED, AS OPPOSED TO WHAT IS SERVED
 *
 * A stored document is its public contract plus server-only fields. Parsing a stored record with the public schema
 * (`MemberSchema.parse`) drops those fields, which is how they never leak into a response.
 */

/** `workspaces/{w}/members/{u}`: the member plus `workspaceId`, for the collection-group query of a person's memberships. */
export const MemberRecordSchema = MemberSchema.extend({ workspaceId: IdSchema });
export type MemberRecord = z.infer<typeof MemberRecordSchema>;

/** `workspaces/{w}/invitations/{i}`: the invitation plus the hash of its secret and who accepted it. */
export const InvitationRecordSchema = InvitationSchema.extend({
    tokenHash: z.string().length(64),
    acceptedBy: IdSchema.nullable(),
    acceptedAt: IsoDateTimeSchema.nullable(),
});
export type InvitationRecord = z.infer<typeof InvitationRecordSchema>;

/** `workspaceSlugs/{slug}`: reserves a slug. Created in the same transaction as the workspace. */
export const SlugRecordSchema = z.object({ workspaceId: IdSchema });
