/**
 * The narrow database surface Paceline uses. In production it is served by the
 * `paceline-db` Durable Object (workers/db), which keeps one MongoDB connection warm;
 * in development it runs in-process. Filters and updates are only ever built on the
 * server from validated values, never passed through from a request body.
 */
import type { Document, Filter, MongoClient, UpdateFilter } from 'mongodb';

export const COLLECTIONS = [
	'users',
	'sessions',
	'codes',
	'limits',
	'workspaces',
	'usernames',
	'audit'
] as const;
export type Coll = (typeof COLLECTIONS)[number];

export interface ManyOptions {
	limit: number;
	sort?: Record<string, 1 | -1>;
	projection?: Record<string, 1>;
}

export interface Gateway {
	findOne(coll: Coll, filter: Document): Promise<Document | null>;
	findMany(coll: Coll, filter: Document, opts: ManyOptions): Promise<Document[]>;
	insertOne(coll: Coll, doc: Document): Promise<{ ok: boolean; duplicate: boolean }>;
	updateOne(
		coll: Coll,
		filter: Document,
		update: Document,
		upsert?: boolean
	): Promise<{ matched: number; modified: number }>;
	findOneAndUpdate(
		coll: Coll,
		filter: Document,
		update: Document,
		upsert?: boolean
	): Promise<Document | null>;
	deleteMany(coll: Coll, filter: Document): Promise<number>;
}

const DB_NAME = 'paceline';

function assertColl(coll: string): asserts coll is Coll {
	if (!(COLLECTIONS as readonly string[]).includes(coll))
		throw new Error(`Unknown collection ${coll}`);
}

/** Lazily connects, creates indexes once, and reconnects after a failure. */
export class MongoCore implements Gateway {
	#client: MongoClient | null = null;
	#ready: Promise<void> | null = null;

	constructor(private readonly create: () => MongoClient) {}

	async #db() {
		if (!this.#client) {
			this.#client = this.create();
			this.#ready = this.#client
				.connect()
				.then(() => this.#indexes())
				.then(() => undefined)
				.catch((e) => {
					this.#client = null;
					this.#ready = null;
					throw e;
				});
		}
		await this.#ready;
		return this.#client!.db(DB_NAME);
	}

	async #indexes() {
		const db = this.#client!.db(DB_NAME);
		await Promise.all([
			db.collection('users').createIndex({ email: 1 }, { unique: true }),
			db.collection('sessions').createIndex({ userId: 1 }),
			db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
			db.collection('codes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
			db.collection('codes').createIndex({ userId: 1 }),
			db.collection('limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
		]);
	}

	async #coll(coll: Coll) {
		assertColl(coll);
		return (await this.#db()).collection<Document>(coll);
	}

	async findOne(coll: Coll, filter: Document) {
		return (await this.#coll(coll)).findOne(filter as Filter<Document>);
	}

	async findMany(coll: Coll, filter: Document, opts: ManyOptions) {
		return (await this.#coll(coll))
			.find(filter as Filter<Document>, { projection: opts.projection, sort: opts.sort })
			.limit(Math.min(opts.limit, 100))
			.toArray();
	}

	async insertOne(coll: Coll, doc: Document) {
		try {
			await (await this.#coll(coll)).insertOne(doc);
			return { ok: true, duplicate: false };
		} catch (e) {
			if ((e as { code?: number }).code === 11000) return { ok: false, duplicate: true };
			throw e;
		}
	}

	async updateOne(coll: Coll, filter: Document, update: Document, upsert = false) {
		const r = await (
			await this.#coll(coll)
		).updateOne(filter as Filter<Document>, update as UpdateFilter<Document>, { upsert });
		return { matched: r.matchedCount, modified: r.modifiedCount };
	}

	async findOneAndUpdate(coll: Coll, filter: Document, update: Document, upsert = false) {
		return (await this.#coll(coll)).findOneAndUpdate(
			filter as Filter<Document>,
			update as UpdateFilter<Document>,
			{ upsert, returnDocument: 'after' }
		);
	}

	async deleteMany(coll: Coll, filter: Document) {
		return (await (await this.#coll(coll)).deleteMany(filter as Filter<Document>)).deletedCount;
	}
}
