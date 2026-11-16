import { z } from 'zod';
import { LocaleSchema } from './locale';
import { DisplayNameSchema, EmailSchema, IdSchema, IsoDateTimeSchema } from './primitives';

/** `users/{userId}`: one per Firebase Auth identity that finished registering. */
export const UserProfileSchema = z.object({
    id: IdSchema,
    email: EmailSchema,
    displayName: DisplayNameSchema,
    locale: LocaleSchema,
    /** The workspace the person is working in. `null` only between leaving the last one and joining another. */
    activeWorkspaceId: IdSchema.nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileRequestSchema = z
    .object({
        displayName: DisplayNameSchema.optional(),
        locale: LocaleSchema.optional(),
    })
    .strict()
    .refine((value) => value.displayName !== undefined || value.locale !== undefined, {
        message: 'Nothing to update',
    });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
