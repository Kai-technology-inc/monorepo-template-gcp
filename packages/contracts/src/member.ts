import { z } from 'zod';
import { DisplayNameSchema, EmailSchema, IdSchema, IsoDateTimeSchema } from './primitives';
import { WorkspaceRoleSchema } from './roles';

/** `workspaces/{workspaceId}/members/{userId}`: the person's role in that workspace. */
export const MemberSchema = z.object({
    userId: IdSchema,
    email: EmailSchema,
    displayName: DisplayNameSchema,
    role: WorkspaceRoleSchema,
    joinedAt: IsoDateTimeSchema,
});
export type Member = z.infer<typeof MemberSchema>;

export const UpdateMemberRoleRequestSchema = z.strictObject({ role: WorkspaceRoleSchema });
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;

export const MemberListResponseSchema = z.object({ members: z.array(MemberSchema) });
export type MemberListResponse = z.infer<typeof MemberListResponseSchema>;
