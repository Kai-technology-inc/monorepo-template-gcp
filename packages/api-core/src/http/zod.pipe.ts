import { Body, Query, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from './app-error';

/**
 * VALIDATION IS THE CONTRACT'S SCHEMA
 *
 * The API parses bodies and queries with the same zod schema the web uses to build them, so there is no second,
 * hand-written DTO to drift. Failure is a `400 VALIDATION_FAILED` with the problems keyed by path.
 *
 *     @Post() create(@ZodBody(CreateWorkspaceRequestSchema) body: CreateWorkspaceRequest) { … }
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
    constructor(private readonly schema: ZodType<T, unknown>) {}

    transform(value: unknown): T {
        const result = this.schema.safeParse(value ?? {});
        if (result.success) return result.data;
        const issues: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
            const path = issue.path.join('.') || '_';
            (issues[path] ??= []).push(issue.message);
        }
        throw new AppError('VALIDATION_FAILED', 400, 'Invalid request', issues);
    }
}

export const ZodBody = <T>(schema: ZodType<T, unknown>): ParameterDecorator =>
    Body(new ZodPipe(schema));

export const ZodQuery = <T>(schema: ZodType<T, unknown>): ParameterDecorator =>
    Query(new ZodPipe(schema));
