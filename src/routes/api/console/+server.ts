import { error, json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import { publicUser } from '#lib/server/auth.ts';
import { run } from '#lib/server/console.ts';
import * as v from '#lib/server/validate.ts';

/** Developer console. Parsed and authorised here, so nothing depends on the screen. */
export async function POST(event) {
	const user = requireUser(event);
	if (!publicUser(user).developer) error(403, 'Developer badge required.');
	const b = await v.body(event.request, 1_024);
	return json({ lines: await run(await context(event), user, v.str(b.command, 'Command', 300)) });
}
