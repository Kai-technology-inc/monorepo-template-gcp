import { ApiErrorBodySchema, type ErrorCode } from '@app/contracts';

/** What the web can say about a failed call: an API error code, or that the server was unreachable. */
export type ApiErrorCode = ErrorCode | 'network' | 'unknown';

export class ApiError extends Error {
    constructor(
        readonly code: ApiErrorCode,
        readonly status: number,
        message: string,
        readonly issues: Readonly<Record<string, readonly string[]>> = {},
        readonly requestId?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Turns an HTTP error response into an `ApiError`. A body that is not an `ApiErrorBody` (a proxy's HTML page, an
 * empty 502) becomes `unknown` with the status, never a crash while reporting a crash.
 */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
    const parsed = ApiErrorBodySchema.safeParse(body);
    if (parsed.success) {
        const { code, message, issues, requestId } = parsed.data;
        return new ApiError(code, status, message, issues ?? {}, requestId);
    }
    return new ApiError('unknown', status, `HTTP ${status}`);
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
    return error instanceof ApiError && (code === undefined || error.code === code);
}

/** The dictionary key for an error: what screens show. Anything that is not an `ApiError` is `unknown`. */
export function errorMessageKey(error: unknown): `errors.${ApiErrorCode}` {
    return `errors.${error instanceof ApiError ? error.code : 'unknown'}`;
}
