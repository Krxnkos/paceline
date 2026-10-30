import { error } from '@sveltejs/kit';
import type { Gateway } from './gateway.ts';

/**
 * Fixed-window counters in the `limits` collection. Each window is its own
 * document (`key:bucket`) that a TTL index removes when the window ends.
 */
function bucketId(key: string, windowMs: number, now = Date.now()) {
	const bucket = Math.floor(now / windowMs);
	return { id: `${key}:${bucket}`, expiresAt: new Date((bucket + 1) * windowMs) };
}

/** Count a hit and return the total in the current window. */
export async function hit(db: Gateway, key: string, windowMs: number): Promise<number> {
	const { id, expiresAt } = bucketId(key, windowMs);
	const doc = await db.findOneAndUpdate(
		'limits',
		{ _id: id },
		{ $inc: { n: 1 }, $setOnInsert: { expiresAt } },
		true
	);
	return (doc?.n as number) ?? 1;
}

/** Throw 429 once a key passes `max` hits in the window. */
export async function limit(db: Gateway, key: string, max: number, windowMs: number) {
	if ((await hit(db, key, windowMs)) > max)
		error(429, 'Too many attempts. Wait a few minutes and try again.');
}

export async function count(db: Gateway, key: string, windowMs: number): Promise<number> {
	const doc = await db.findOne('limits', { _id: bucketId(key, windowMs).id });
	return (doc?.n as number) ?? 0;
}

export async function clear(db: Gateway, key: string, windowMs: number) {
	await db.deleteMany('limits', { _id: bucketId(key, windowMs).id });
}
