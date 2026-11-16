import { z } from 'zod';

/**
 * THE API NEVER SENDS UI TEXT
 *
 * Every error the API answers carries a stable `code`. The web translates it (`errors.<CODE>` in `@app/i18n`), so
 * the same failure reads right in every language and a rewording never touches the backend. `message` is for logs
 * and developers, in English.
 */
export const ERROR_CODES = [
    'UNAUTHENTICATED',
    'EMAIL_NOT_VERIFIED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_FAILED',
    'CONFLICT',
    'ALREADY_REGISTERED',
    'NOT_REGISTERED',
    'NOT_A_MEMBER',
    'SLUG_TAKEN',
    'LAST_OWNER',
    'CANNOT_CHANGE_OWN_ROLE',
    'ALREADY_A_MEMBER',
    'INVITATION_INVALID',
    'INVITATION_EXPIRED',
    'INVITATION_EMAIL_MISMATCH',
    'RATE_LIMITED',
    'INTERNAL',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
    statusCode: z.number().int(),
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    /** Field-level problems of a `VALIDATION_FAILED`, keyed by path (`"email"`, `"members.0.role"`). */
    issues: z.record(z.string(), z.array(z.string())).optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export function isErrorCode(value: unknown): value is ErrorCode {
    return ErrorCodeSchema.safeParse(value).success;
}
