import { json } from '@sveltejs/kit';
import { publicUser } from '#lib/server/auth.ts';

export function GET({ locals }) {
	return json({ user: locals.user ? publicUser(locals.user) : null });
}
