/**
 * paceline-db: a Durable Object that owns the MongoDB connection.
 *
 * Workers can't share a socket between requests, so the app reaches MongoDB
 * through this one object. It keeps the TLS + SCRAM handshake warm between
 * calls, which keeps each app request inside the Workers Free CPU budget.
 * It has no public route; only the `paceline` Worker can call it.
 */
import { DurableObject } from 'cloudflare:workers';
import { MongoClient, type Document } from 'mongodb';
import { MongoCore, type Coll } from '../../../src/lib/server/gateway.ts';

interface Env {
	MONGODB_URI: string;
}

export class MongoGateway extends DurableObject<Env> {
	core: MongoCore;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.core = new MongoCore(
			() =>
				new MongoClient(env.MONGODB_URI, {
					maxPoolSize: 1,
					minPoolSize: 0,
					serverSelectionTimeoutMS: 5000,
					maxIdleTimeMS: 20_000,
					appName: 'paceline'
				})
		);
	}

	findOne(coll: Coll, filter: Document) {
		return this.core.findOne(coll, filter);
	}
	insertOne(coll: Coll, doc: Document) {
		return this.core.insertOne(coll, doc);
	}
	updateOne(coll: Coll, filter: Document, update: Document, upsert?: boolean) {
		return this.core.updateOne(coll, filter, update, upsert);
	}
	findOneAndUpdate(coll: Coll, filter: Document, update: Document, upsert?: boolean) {
		return this.core.findOneAndUpdate(coll, filter, update, upsert);
	}
	deleteMany(coll: Coll, filter: Document) {
		return this.core.deleteMany(coll, filter);
	}
}

export default {
	fetch() {
		return new Response('Not found', { status: 404 });
	}
} satisfies ExportedHandler<Env>;
