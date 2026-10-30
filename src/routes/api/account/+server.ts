import { json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import { deleteAccount, publicUser } from '#lib/server/auth.ts';
import * as v from '#lib/server/validate.ts';

export async function PATCH(event) {
	const user = requireUser(event);
	const b = await v.body(event.request);
	const name = v.str(b.name, 'Name', 80);
	const ctx = await context(event);
	await ctx.db.updateOne('users', { _id: user._id }, { $set: { name } });
	return json({ user: publicUser({ ...user, name }) });
}

export async function DELETE(event) {
	const user = requireUser(event);
	await deleteAccount(await context(event), user);
	return json({ ok: true });
}
