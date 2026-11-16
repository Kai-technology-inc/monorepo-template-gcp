import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '@app/contracts';

const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export interface RequestWithId extends Request {
    requestId?: string;
}

/**
 * Every request gets an id: the caller's `X-Request-Id` when it is well formed, a fresh UUID otherwise. It is echoed
 * in the response header and in every error body, so a screenshot of an error is enough to find its log line.
 */
export function requestIdMiddleware(
    request: RequestWithId,
    response: Response,
    next: NextFunction,
): void {
    const incoming = request.header(REQUEST_ID_HEADER);
    const requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
}
