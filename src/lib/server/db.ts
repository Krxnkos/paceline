import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import type { Gateway } from './gateway.ts';

/**
 * The database for this request. Production: the paceline-db Durable Object
 * (bound as DB in wrangler.jsonc). Development: an in-process MongoDB client
 * (dev-db.ts), which the build drops because `dev` is a compile-time constant.
 */
export async function getDb(): Promise<Gateway> {
	if (dev) {
		const { devGateway } = await import('./dev-db.ts');
		return devGateway();
	}
	const ns = env.DB;
	if (!ns) error(503, 'Database binding missing.');
	return ns.get(ns.idFromName('primary')) as unknown as Gateway;
}
