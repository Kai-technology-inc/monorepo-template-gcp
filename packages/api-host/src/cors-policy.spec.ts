import { describe, expect, it } from 'vitest';
import { corsOptions } from './cors-policy';

describe('corsOptions', () => {
    it('allows exactly the configured origins', () => {
        expect(corsOptions(['https://app.example.com']).origin).toEqual([
            'https://app.example.com',
        ]);
    });

    it('fails closed without an allow-list', () => {
        expect(corsOptions([]).origin).toBe(false);
    });

    it('names the headers the web sends and never allows credentials', () => {
        const options = corsOptions(['https://app.example.com']);
        expect(options.allowedHeaders).toEqual(['Authorization', 'Content-Type', 'X-Request-Id']);
        expect(options.credentials).toBe(false);
    });
});
