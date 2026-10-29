import { json } from '@sveltejs/kit';
import { context } from '#lib/server/api.ts';
import { signOut } from '#lib/server/auth.ts';

export async function POST(event) {
	await signOut(await context(event));
	return json({ ok: true });
}
