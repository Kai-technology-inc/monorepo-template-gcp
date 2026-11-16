import { z } from 'zod';

/** Firestore document ids: non-empty, no slashes, at most 128 chars. */
export const IdSchema = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[^/]+$/, 'An id cannot contain "/"');

/** Timestamps travel as ISO 8601 strings; the API converts Firestore `Timestamp`s at the edge. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const DisplayNameSchema = z.string().trim().min(1).max(80);
