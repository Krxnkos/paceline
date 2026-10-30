import { error, json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import * as v from '#lib/server/validate.ts';
import { tierInfo } from '#lib/tiers.ts';

/** One document per person: their whole plan, versioned so two devices can't silently overwrite each other. */
export async function GET(event) {
	const user = requireUser(event);
	const { db } = await context(event);
	const doc = await db.findOne('workspaces', { _id: user._id });
	return json(doc ? { data: doc.data, version: doc.version } : { data: null, version: 0 });
}

export async function PUT(event) {
	const user = requireUser(event);
	const b = await v.body(event.request, 1_500_000);
	const data = v.workspace(b.data);
	const version = Number(b.version);
	if (!Number.isInteger(version) || version < 0) error(400, 'Invalid version.');
	const { db } = await context(event);

	// Plan limits: only growth past the limit is refused, so a downgrade never blocks saving.
	const plan = tierInfo(user.tier);
	const saved0 = await db.findOne('workspaces', { _id: user._id });
	for (const k of ['projects', 'goals'] as const) {
		const count = (data[k] as unknown[]).length;
		const had = ((saved0?.data as Record<string, unknown[]> | undefined)?.[k] ?? []).length;
		if (count > plan[k] && count > had) error(403, `${plan.label} includes ${plan[k]} ${k}.`);
	}

	const next = version + 1;
	const r =
		version === 0
			? await db.insertOne('workspaces', {
					_id: user._id,
					data,
					version: next,
					updatedAt: new Date()
				})
			: await db.updateOne(
					'workspaces',
					{ _id: user._id, version },
					{ $set: { data, version: next, updatedAt: new Date() } }
				);
	const saved = 'matched' in r ? r.matched === 1 : r.ok;
	if (!saved) {
		// Someone else saved first: hand back the current copy.
		const doc = await db.findOne('workspaces', { _id: user._id });
		return json(
			{ conflict: true, data: doc?.data ?? null, version: doc?.version ?? 0 },
			{ status: 409 }
		);
	}
	return json({ version: next });
}
