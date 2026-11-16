import { describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppError } from './app-error';

function run(exception: unknown): { status: number; body: unknown } {
    const result: { status: number; body: unknown } = { status: 0, body: undefined };
    const response = {
        status(code: number) {
            result.status = code;
            return this;
        },
        json(body: unknown) {
            result.body = body;
        },
    };
    const host = {
        switchToHttp: () => ({
            getRequest: () => ({ method: 'GET', url: '/x', requestId: 'req-12345678' }),
            getResponse: () => response,
        }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(exception, host);
    return result;
}

describe('AllExceptionsFilter', () => {
    it('keeps the code of an AppError', () => {
        expect(run(new AppError('LAST_OWNER', 409, 'Needs an owner'))).toEqual({
            status: 409,
            body: {
                statusCode: 409,
                code: 'LAST_OWNER',
                message: 'Needs an owner',
                requestId: 'req-12345678',
            },
        });
    });

    it('maps a plain HttpException by status', () => {
        const { status, body } = run(new NotFoundException('Cannot GET /x'));
        expect(status).toBe(404);
        expect(body).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('hides the message of an unexpected error', () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        expect(run(new Error('password=hunter2'))).toEqual({
            status: 500,
            body: {
                statusCode: 500,
                code: 'INTERNAL',
                message: 'Internal error',
                requestId: 'req-12345678',
            },
        });
    });
});
