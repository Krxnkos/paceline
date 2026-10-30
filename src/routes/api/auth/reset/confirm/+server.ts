import { json } from '@sveltejs/kit';
import { context } from '#lib/server/api.ts';
import { confirmReset } from '#lib/server/auth.ts';
import * as v from '#lib/server/validate.ts';

export async function POST(event) {
	const b = await v.body(event.request);
	return json(
		await confirmReset(await context(event), v.token(b.token), v.password(b.password, true))
	);
}
