import {
    ArgumentsHost,
    Catch,
    HttpException,
    HttpStatus,
    Logger,
    type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { isErrorCode, type ApiErrorBody, type ErrorCode } from '@app/contracts';
import type { RequestWithId } from './request-id';

const CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
    400: 'VALIDATION_FAILED',
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
};

/**
 * EVERY ERROR LEAVES AS AN `ApiErrorBody`
 *
 * Deliberate errors (`AppError`) keep their code and message. Other `HttpException`s (Nest's own 404 for an unknown
 * route, a 413 from the body parser) get the code of their status. Anything else is a bug: it is logged with its
 * stack and answered as a generic `500 INTERNAL`, never with its message, which could carry internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const request = http.getRequest<RequestWithId>();
        const response = http.getResponse<Response>();
        const body = this.toBody(exception, request);
        if (body.statusCode >= 500) {
            this.logger.error(
                `${request.method} ${request.url} → ${body.statusCode} [${body.requestId ?? '-'}]`,
                exception instanceof Error ? exception.stack : String(exception),
            );
        }
        response.status(body.statusCode).json(body);
    }

    private toBody(exception: unknown, request: RequestWithId): ApiErrorBody {
        const requestId = request.requestId;
        if (exception instanceof HttpException) {
            const statusCode = exception.getStatus();
            const payload = exception.getResponse();
            const record =
                typeof payload === 'object' && payload !== null
                    ? (payload as Record<string, unknown>)
                    : {};
            const code = isErrorCode(record.code)
                ? record.code
                : (CODE_BY_STATUS[statusCode] ??
                  (statusCode >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED'));
            const message =
                typeof record.message === 'string'
                    ? record.message
                    : typeof payload === 'string'
                      ? payload
                      : exception.message;
            const issues = record.issues as Record<string, string[]> | undefined;
            return {
                statusCode,
                code,
                message: statusCode >= 500 ? 'Internal error' : message,
                ...(requestId ? { requestId } : {}),
                ...(issues ? { issues } : {}),
            };
        }
        if (isFirestoreContention(exception)) {
            return {
                statusCode: HttpStatus.CONFLICT,
                code: 'CONFLICT',
                message: 'Concurrent modification, retry',
                ...(requestId ? { requestId } : {}),
            };
        }
        return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL',
            message: 'Internal error',
            ...(requestId ? { requestId } : {}),
        };
    }
}

/** gRPC ABORTED (10): a transaction lost against a concurrent one after its retries. */
function isFirestoreContention(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 10;
}
