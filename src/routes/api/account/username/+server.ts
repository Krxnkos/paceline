import { error, json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import { publicUser } from '#lib/server/auth.ts';
import { checkUsername } from '#lib/server/username.ts';
import { limit } from '#lib/server/limits.ts';
import * as v from '#lib/server/validate.ts';

/** Sets a username once. The filter on the update means it can never be replaced. */
export async function POST(event) {
	const user = requireUser(event);
	if (user.username) error(409, 'Your username is permanent and can’t be changed.');
	const ctx = await context(event);
	await limit(ctx.db, `username:${user._id}`, 20, 15 * 60_000);

	const check = checkUsername((await v.body(event.request)).username);
	if (!check.ok) error(400, check.error);

	// The _id on this collection is what makes each username unique.
	const claim = await ctx.db.insertOne('usernames', { _id: check.username, userId: user._id });
	if (!claim.ok) error(409, 'That username is taken.');
	const r = await ctx.db.updateOne(
		'users',
		{ _id: user._id, username: { $exists: false } },
		{ $set: { username: check.username } }
	);
	if (r.matched !== 1) {
		await ctx.db.deleteMany('usernames', { _id: check.username, userId: user._id });
		error(409, 'Your username is permanent and can’t be changed.');
	}
	return json({ user: publicUser({ ...user, username: check.username }) });
}
