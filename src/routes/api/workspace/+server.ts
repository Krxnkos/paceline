import { error, json } from '@sveltejs/kit';
import { context, requireUser } from '#lib/server/api.ts';
import * as v from '#lib/server/validate.ts';
import { effectiveTier, tierInfo } from '#lib/tiers.ts';

/** One document per person: their whole plan, versioned so two devices can't silently overwrite each other. */
export async function GET(event) {
	const user = requireUser(event);
	const { db } = await context(event);
	const doc = await db.findOne('workspaces', { _id: user._id });
	return json(
		doc
			? { data: doc.data, version: doc.version, saveId: doc.saveId ?? null }
			: { data: null, version: 0, saveId: null }
	);
}

export async function PUT(event) {
	const user = requireUser(event);
	const b = await v.body(event.request, 1_500_000);
	const data = v.workspace(b.data);
	const version = Number(b.version);
	if (!Number.isInteger(version) || version < 0) error(400, 'Invalid version.');
	const saveId = typeof b.saveId === 'string' && /^[\w-]{6,40}$/.test(b.saveId) ? b.saveId : null;
	const { db } = await context(event);

	// Plan limits: only growth past the limit is refused, so a downgrade never blocks saving.
	const plan = tierInfo(effectiveTier(user));
	const saved0 = await db.findOne('workspaces', { _id: user._id });
	for (const k of ['projects', 'goals'] as const) {
		const count = (data[k] as unknown[]).length;
		const had = ((saved0?.data as Record<string, unknown[]> | undefined)?.[k] ?? []).length;
		if (count > plan[k] && count > had)
			return json(
				{ message: `${plan.label} includes ${plan[k]} ${k}.`, code: 'limit' },
				{ status: 403 }
			);
	}

	const next = version + 1;
	const r =
		version === 0
			? await db.insertOne('workspaces', {
					_id: user._id,
					data,
					version: next,
					saveId,
					updatedAt: new Date()
				})
			: await db.updateOne(
					'workspaces',
					{ _id: user._id, version },
					{ $set: { data, version: next, saveId, updatedAt: new Date() } }
				);
	const saved = 'matched' in r ? r.matched === 1 : r.ok;
	if (!saved) {
		const doc = await db.findOne('workspaces', { _id: user._id });
		// Our own earlier attempt landed but its reply was lost (a timeout, a dropped
		// connection): this is the same save, so apply it on top instead of clashing.
		if (saveId && doc?.saveId === saveId && doc.version === next) {
			const again = await db.updateOne(
				'workspaces',
				{ _id: user._id, version: next, saveId },
				{ $set: { data, version: next + 1, saveId, updatedAt: new Date() } }
			);
			if (again.matched === 1) return json({ version: next + 1 });
		}
		// Someone else saved first: hand back the current copy.
		return json(
			{ conflict: true, data: doc?.data ?? null, version: doc?.version ?? 0 },
			{ status: 409 }
		);
	}
	return json({ version: next });
}
