import { randomUUID } from 'node:crypto';
import {
    Store,
    type DocumentData,
    type QueryOptions,
    type StoredDocument,
    type Transaction,
    type Where,
} from '../persistence/store';

/** The gRPC codes Firestore uses, so error handling written against the real thing also works here. */
const ALREADY_EXISTS = 6;
const NOT_FOUND = 5;

class StoreError extends Error {
    constructor(
        readonly code: number,
        message: string,
    ) {
        super(message);
    }
}

/**
 * `Store` in memory, for unit tests. It keeps Firestore's rules that matter for correctness: transactions run one at
 * a time and atomically, reads after a write in the same transaction throw, `create` fails on an existing document
 * and `update` on a missing one. Values are deep-copied in and out, so a test cannot mutate stored state by accident.
 */
export class InMemoryStore extends Store {
    private readonly docs = new Map<string, DocumentData>();
    private queue: Promise<unknown> = Promise.resolve();

    newId(): string {
        return randomUUID().replace(/-/g, '').slice(0, 20);
    }

    /** Test helper: write a document directly. */
    seed(path: string, data: DocumentData): void {
        this.docs.set(path, clone(data));
    }

    /** Test helper: every document path, sorted. */
    paths(): string[] {
        return [...this.docs.keys()].sort();
    }

    get(path: string): Promise<DocumentData | null> {
        return Promise.resolve(this.read(path));
    }

    getAll(paths: readonly string[]): Promise<(DocumentData | null)[]> {
        return Promise.resolve(paths.map((path) => this.read(path)));
    }

    query(
        collectionPath: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return Promise.resolve(
            this.select((path) => parentOf(path) === collectionPath, filters, options),
        );
    }

    collectionGroup(
        collectionId: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return Promise.resolve(
            this.select(
                (path) => parentOf(path).split('/').pop() === collectionId,
                filters,
                options,
            ),
        );
    }

    runTransaction<R>(callback: (tx: Transaction) => Promise<R>): Promise<R> {
        const run = this.queue.then(async () => {
            const tx = new InMemoryTransaction(this);
            const result = await callback(tx);
            tx.commit();
            return result;
        });
        this.queue = run.catch(() => undefined);
        return run;
    }

    /** @internal */
    read(path: string): DocumentData | null {
        const data = this.docs.get(path);
        return data ? clone(data) : null;
    }

    /** @internal */
    apply(writes: readonly Write[]): void {
        for (const write of writes) {
            const exists = this.docs.has(write.path);
            if (write.kind === 'create' && exists) {
                throw new StoreError(ALREADY_EXISTS, `Document already exists: ${write.path}`);
            }
            if (write.kind === 'update' && !exists) {
                throw new StoreError(NOT_FOUND, `No document to update: ${write.path}`);
            }
        }
        for (const write of writes) {
            if (write.kind === 'delete') this.docs.delete(write.path);
            else if (write.kind === 'update') {
                this.docs.set(write.path, {
                    ...this.docs.get(write.path),
                    ...clone(write.data ?? {}),
                });
            } else this.docs.set(write.path, clone(write.data ?? {}));
        }
    }

    private select(
        match: (path: string) => boolean,
        filters: readonly Where[],
        options?: QueryOptions,
    ): StoredDocument[] {
        let results = [...this.docs.entries()]
            .filter(
                ([path, data]) => match(path) && filters.every((filter) => matches(data, filter)),
            )
            .map(([path, data]) => ({
                id: path.split('/').pop() as string,
                path,
                data: clone(data),
            }));
        if (options?.orderBy) {
            const { field, direction = 'asc' } = options.orderBy;
            const sign = direction === 'asc' ? 1 : -1;
            results = results.sort((a, b) => sign * compare(a.data[field], b.data[field]));
        } else {
            results = results.sort((a, b) => compare(a.path, b.path));
        }
        return options?.limit === undefined ? results : results.slice(0, options.limit);
    }
}

interface Write {
    readonly kind: 'create' | 'set' | 'update' | 'delete';
    readonly path: string;
    readonly data?: DocumentData;
}

class InMemoryTransaction implements Transaction {
    private readonly writes: Write[] = [];

    constructor(private readonly store: InMemoryStore) {}

    get(path: string): Promise<DocumentData | null> {
        this.assertNoWrites();
        return this.store.get(path);
    }

    getAll(paths: readonly string[]): Promise<(DocumentData | null)[]> {
        this.assertNoWrites();
        return this.store.getAll(paths);
    }

    query(
        collectionPath: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        this.assertNoWrites();
        return this.store.query(collectionPath, filters, options);
    }

    collectionGroup(
        collectionId: string,
        filters?: readonly Where[],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        this.assertNoWrites();
        return this.store.collectionGroup(collectionId, filters, options);
    }

    create(path: string, data: DocumentData): void {
        this.writes.push({ kind: 'create', path, data });
    }

    set(path: string, data: DocumentData): void {
        this.writes.push({ kind: 'set', path, data });
    }

    update(path: string, data: DocumentData): void {
        this.writes.push({ kind: 'update', path, data });
    }

    delete(path: string): void {
        this.writes.push({ kind: 'delete', path });
    }

    commit(): void {
        this.store.apply(this.writes);
    }

    private assertNoWrites(): void {
        if (this.writes.length > 0) {
            throw new Error(
                'Firestore transactions require all reads to be executed before all writes.',
            );
        }
    }
}

function parentOf(path: string): string {
    return path.split('/').slice(0, -1).join('/');
}

function matches(data: DocumentData, filter: Where): boolean {
    const value = data[filter.field];
    switch (filter.op) {
        case '==':
            return value === filter.value;
        case '!=':
            return value !== filter.value && value !== undefined;
        case '<':
            return compare(value, filter.value) < 0;
        case '<=':
            return compare(value, filter.value) <= 0;
        case '>':
            return compare(value, filter.value) > 0;
        case '>=':
            return compare(value, filter.value) >= 0;
        case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
        case 'array-contains':
            return Array.isArray(value) && value.includes(filter.value);
    }
}

function compare(a: unknown, b: unknown): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
}

function clone<T>(value: T): T {
    return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
