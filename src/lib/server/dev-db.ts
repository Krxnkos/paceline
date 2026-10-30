/**
 * Development-only database: uses MONGODB_URI from .env when set, otherwise an
 * in-memory MongoDB that's thrown away when the dev server stops.
 */
import { MONGODB_URI } from '$app/env/private';
import { MongoClient } from 'mongodb';
import { MongoCore } from './gateway.ts';

let core: Promise<MongoCore> | null = null;

export function devGateway(): Promise<MongoCore> {
	core ??= (async () => {
		let uri = MONGODB_URI;
		if (!uri) {
			const { MongoMemoryServer } = await import('mongodb-memory-server');
			const mem = await MongoMemoryServer.create();
			uri = mem.getUri();
			console.info('[paceline] No MONGODB_URI set: using a throwaway in-memory MongoDB.');
		}
		return new MongoCore(() => new MongoClient(uri!, { appName: 'paceline-dev' }));
	})();
	return core;
}
