import { json } from '@sveltejs/kit';
import { context } from '#lib/server/api.ts';
import { signUp } from '#lib/server/auth.ts';
import * as v from '#lib/server/validate.ts';

export async function POST(event) {
	const b = await v.body(event.request);
	const name = v.str(b.name, 'Name', 80);
	const email = v.email(b.email);
	const password = v.password(b.password, true);
	return json(await signUp(await context(event), name, email, password));
}
