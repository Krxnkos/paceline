import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { config } from './config.ts';
import { getDb } from './db.ts';
import type { Ctx, UserDoc } from './auth.ts';

/** Everything an API handler needs, built once per request. */
export async function context(event: RequestEvent): Promise<Ctx> {
	const cfg = config();
	return {
		db: await getDb(),
		cfg,
		cookies: event.cookies,
		ip: event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress(),
		origin: cfg.origin || event.url.origin
	};
}

export function requireUser(event: RequestEvent): UserDoc {
	if (!event.locals.user) error(401, 'Sign in to continue.');
	return event.locals.user;
}
