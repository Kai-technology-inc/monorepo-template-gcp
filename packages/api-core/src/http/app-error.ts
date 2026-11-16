import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@app/contracts';

/**
 * THE ONE WAY TO FAIL ON PURPOSE
 *
 * `throw new AppError('LAST_OWNER', 409, 'A workspace needs at least one owner')`. The code is what the web
 * translates; the message is English and for developers. `AllExceptionsFilter` turns it into an `ApiErrorBody`.
 */
export class AppError extends HttpException {
    constructor(
        readonly code: ErrorCode,
        status: number,
        message: string,
        readonly issues?: Record<string, string[]>,
    ) {
        super({ code, message, ...(issues ? { issues } : {}) }, status);
    }
}

export const notFound = (message = 'Not found'): AppError =>
    new AppError('NOT_FOUND', 404, message);
export const forbidden = (message = 'Forbidden'): AppError =>
    new AppError('FORBIDDEN', 403, message);
