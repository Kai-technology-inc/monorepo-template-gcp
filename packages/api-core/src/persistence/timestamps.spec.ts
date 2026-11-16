import { describe, expect, it } from '@jest/globals';
import { Timestamp } from 'firebase-admin/firestore';
import { fromFirestore, toFirestore } from './timestamps';

describe('timestamps', () => {
    it('stores ISO strings in …At fields as Timestamps and reads them back', () => {
        const stored = toFirestore({
            createdAt: '2026-01-02T03:04:05.000Z',
            name: '2026-01-02T03:04:05.000Z',
        }) as Record<string, unknown>;
        expect(stored.createdAt).toBeInstanceOf(Timestamp);
        expect(stored.name).toBe('2026-01-02T03:04:05.000Z');
        expect(fromFirestore(stored)).toEqual({
            createdAt: '2026-01-02T03:04:05.000Z',
            name: '2026-01-02T03:04:05.000Z',
        });
    });

    it('never writes undefined', () => {
        expect(toFirestore({ a: undefined, b: [undefined] })).toEqual({ a: null, b: [null] });
    });
});
