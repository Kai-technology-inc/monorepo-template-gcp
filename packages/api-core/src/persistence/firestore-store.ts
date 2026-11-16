import type { App } from 'firebase-admin/app';
import {
    getFirestore,
    type DocumentSnapshot,
    type Firestore,
    type Query,
    type Transaction as FirestoreTransaction,
} from 'firebase-admin/firestore';
import { fromFirestore, toFirestore } from './timestamps';
import {
    Store,
    type DocumentData,
    type QueryOptions,
    type StoredDocument,
    type Transaction,
    type Where,
} from './store';

/** `Store` over Cloud Firestore through the Admin SDK. */
export class FirestoreStore extends Store {
    private readonly db: Firestore;

    constructor(app: App) {
        super();
        this.db = getFirestore(app);
    }

    newId(): string {
        return this.db.collection('_').doc().id;
    }

    async get(path: string): Promise<DocumentData | null> {
        return read(await this.db.doc(path).get());
    }

    async getAll(paths: readonly string[]): Promise<(DocumentData | null)[]> {
        if (paths.length === 0) return [];
        const snapshots = await this.db.getAll(...paths.map((path) => this.db.doc(path)));
        return snapshots.map(read);
    }

    async query(
        collectionPath: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return documents(
            await buildQuery(this.db.collection(collectionPath), filters, options).get(),
        );
    }

    async collectionGroup(
        collectionId: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return documents(
            await buildQuery(this.db.collectionGroup(collectionId), filters, options).get(),
        );
    }

    runTransaction<R>(callback: (tx: Transaction) => Promise<R>): Promise<R> {
        return this.db.runTransaction((tx) =>
            callback(new FirestoreTransactionAdapter(this.db, tx)),
        );
    }
}

class FirestoreTransactionAdapter implements Transaction {
    constructor(
        private readonly db: Firestore,
        private readonly tx: FirestoreTransaction,
    ) {}

    async get(path: string): Promise<DocumentData | null> {
        return read(await this.tx.get(this.db.doc(path)));
    }

    async getAll(paths: readonly string[]): Promise<(DocumentData | null)[]> {
        if (paths.length === 0) return [];
        const snapshots = await this.tx.getAll(...paths.map((path) => this.db.doc(path)));
        return snapshots.map(read);
    }

    async query(
        collectionPath: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return documents(
            await this.tx.get(buildQuery(this.db.collection(collectionPath), filters, options)),
        );
    }

    async collectionGroup(
        collectionId: string,
        filters: readonly Where[] = [],
        options?: QueryOptions,
    ): Promise<StoredDocument[]> {
        return documents(
            await this.tx.get(buildQuery(this.db.collectionGroup(collectionId), filters, options)),
        );
    }

    create(path: string, data: DocumentData): void {
        this.tx.create(this.db.doc(path), toFirestore(data) as DocumentData);
    }

    set(path: string, data: DocumentData): void {
        this.tx.set(this.db.doc(path), toFirestore(data) as DocumentData);
    }

    update(path: string, data: DocumentData): void {
        this.tx.update(this.db.doc(path), toFirestore(data) as DocumentData);
    }

    delete(path: string): void {
        this.tx.delete(this.db.doc(path));
    }
}

function buildQuery(base: Query, filters: readonly Where[], options?: QueryOptions): Query {
    let query = base;
    for (const filter of filters) {
        query = query.where(filter.field, filter.op, toFirestore(filter.value, filter.field));
    }
    if (options?.orderBy)
        query = query.orderBy(options.orderBy.field, options.orderBy.direction ?? 'asc');
    if (options?.limit !== undefined) query = query.limit(options.limit);
    return query;
}

function read(snapshot: DocumentSnapshot): DocumentData | null {
    return snapshot.exists ? (fromFirestore(snapshot.data()) as DocumentData) : null;
}

function documents(snapshot: { docs: DocumentSnapshot[] }): StoredDocument[] {
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        path: doc.ref.path,
        data: fromFirestore(doc.data()) as DocumentData,
    }));
}
