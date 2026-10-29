import { json } from '@sveltejs/kit';
import { context } from '#lib/server/api.ts';
import { signIn } from '#lib/server/auth.ts';
import * as v from '#lib/server/validate.ts';

export async function POST(event) {
	const b = await v.body(event.request);
	return json(
		await signIn(
			await context(event),
			v.email(b.email),
			v.password(b.password, false),
			b.remember !== false
		)
	);
}
