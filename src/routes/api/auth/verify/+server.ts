import { json } from '@sveltejs/kit';
import { context } from '#lib/server/api.ts';
import { verify } from '#lib/server/auth.ts';
import * as v from '#lib/server/validate.ts';

export async function POST(event) {
	const b = await v.body(event.request);
	return json(
		await verify(await context(event), v.email(b.email), v.purpose(b.purpose), v.code(b.code))
	);
}
