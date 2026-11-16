import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from './app-error';
import { ZodPipe } from './zod.pipe';

describe('ZodPipe', () => {
    const pipe = new ZodPipe(z.object({ email: z.string().email(), n: z.number() }).strict());

    it('returns the parsed value', () => {
        expect(pipe.transform({ email: 'a@b.co', n: 1 })).toEqual({ email: 'a@b.co', n: 1 });
    });

    it('fails with VALIDATION_FAILED and issues by path', () => {
        try {
            pipe.transform({ email: 'nope', extra: true });
            throw new Error('should have failed');
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            const appError = error as AppError;
            expect(appError.code).toBe('VALIDATION_FAILED');
            expect(appError.getStatus()).toBe(400);
            expect(Object.keys(appError.issues ?? {}).sort()).toEqual(['_', 'email', 'n']);
        }
    });
});
