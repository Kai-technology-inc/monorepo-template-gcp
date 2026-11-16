import type { ZodType } from 'zod';

/**
 * THE PERSISTENCE PORT
 *
 * Services read and write documents through `Store`, never through the Firestore SDK. Two reasons:
 *
 * - **Tests.** `InMemoryStore` (`testing/in-memory-store.ts`) implements the same contract, transactions included, so
 *   every business rule is unit-tested in milliseconds without emulators.
 * - **One place for the conventions.** Documents are plain JSON. Timestamps travel as ISO 8601 strings and fields
 *   named `…At` are stored as Firestore `Timestamp`s (`timestamps.ts`). `undefined` is never written: absence is an
 *   explicit `null`.
 *
 * Paths are slash-separated (`workspaces/w1/members/u1`). Keep path building in one helper per module (`paths.ts`),
 * never inline.
 */
export type DocumentData = Record<string, unknown>;

export interface StoredDocument<T = DocumentData> {
    readonly id: string;
    readonly path: string;
    readonly data: T;
}

export type WhereOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

export interface Where {
    readonly field: string;
    readonly op: WhereOperator;
    readonly value: unknown;
}

export interface QueryOptions {
    readonly orderBy?: { readonly field: string; readonly direction?: 'asc' | 'desc' };
    readonly limit?: number;
}

export const where = (field: string, op: WhereOperator, value: unknown): Where => ({
    field,
    op,
    value,
});

export interface StoreReader {
    get(path: string): Promise<DocumentData | null>;
    getAll(paths: readonly string[]): Promise<(DocumentData | null)[]>;
    /** Documents directly under `collectionPath` (`workspaces/w1/members`). */
    query(
        collectionPath: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]>;
    /** Documents of every collection named `collectionId`, at any depth. Needs a collection-group index. */
    collectionGroup(
        collectionId: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]>;
}

/**
 * A transaction: every read first, then the writes, which apply atomically when the callback resolves. Firestore
 * retries the callback on contention, so it must have no side effects other than these writes.
 */
export interface Transaction extends StoreReader {
    /** Fails the whole transaction if the document already exists. */
    create(path: string, data: DocumentData): void;
    set(path: string, data: DocumentData): void;
    /** Merges top-level fields. Fails the whole transaction if the document does not exist. */
    update(path: string, data: DocumentData): void;
    delete(path: string): void;
}

export abstract class Store implements StoreReader {
    abstract newId(): string;
    abstract get(path: string): Promise<DocumentData | null>;
    abstract getAll(paths: readonly string[]): Promise<(DocumentData | null)[]>;
    abstract query(
        collectionPath: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]>;
    abstract collectionGroup(
        collectionId: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]>;
    abstract runTransaction<R>(callback: (tx: Transaction) => Promise<R>): Promise<R>;
}

/** Parses a stored document with its schema. A document that does not match is a bug or a missing migration. */
export function parseDocument<T>(schema: ZodType<T, unknown>, data: DocumentData, path: string): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new Error(`Document ${path} does not match its schema: ${result.error.message}`);
    }
    return result.data;
}

export function idOf(path: string): string {
    const id = path.split('/').pop();
    if (!id) throw new Error(`Invalid document path: ${path}`);
    return id;
}
