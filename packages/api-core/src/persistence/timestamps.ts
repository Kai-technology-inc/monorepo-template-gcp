import { Timestamp } from 'firebase-admin/firestore';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Fields named `…At` (`createdAt`, `expiresAt`) holding an ISO string are stored as `Timestamp`s. */
export function isTimestampField(key: string): boolean {
    return /At$/.test(key);
}

export function toFirestore(value: unknown, key = ''): unknown {
    if (value === undefined) return null;
    if (typeof value === 'string' && isTimestampField(key) && ISO_DATE_TIME.test(value)) {
        return Timestamp.fromDate(new Date(value));
    }
    if (Array.isArray(value)) return value.map((item) => toFirestore(item));
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFirestore(v, k)]));
    }
    return value;
}

export function fromFirestore(value: unknown): unknown {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(fromFirestore);
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromFirestore(v)]));
    }
    return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype
    );
}
