import { error, json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import { publicUser } from '#lib/server/auth.ts';

/** Server diagnostics for accounts with the Developer badge. Metadata only, own data only. */
export async function GET(event) {
	const user = requireUser(event);
	if (!publicUser(user).developer) error(403, 'Developer badge required.');
	const { db, cfg } = await context(event);
	const started = Date.now();
	const doc = await db.findOne('workspaces', { _id: user._id });
	return json({
		dbPingMs: Date.now() - started,
		emailConfigured: !!cfg.resendKey,
		pbkdf2Iterations: cfg.iterations,
		workspace: doc
			? { version: doc.version, updatedAt: doc.updatedAt, bytes: JSON.stringify(doc.data).length }
			: null,
		serverTime: new Date().toISOString()
	});
}
