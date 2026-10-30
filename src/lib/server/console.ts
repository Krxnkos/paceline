import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import type { Ctx, UserDoc } from './auth.ts';
import { TIERS, effectiveTier, tierInfo, type Tier } from '../tiers.ts';
import { limit } from './limits.ts';

export interface Line {
	text: string;
	tone?: 'ok' | 'err' | 'muted';
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MAX_MS = 3650 * DAY;

/** Only these fields ever leave the users collection here: never password data. */
const SAFE: Record<string, 1> = {
	email: 1,
	name: 1,
	username: 1,
	tier: 1,
	tierExpiresAt: 1,
	developer: 1,
	verified: 1,
	createdAt: 1
};

const HELP: Line[] = [
	{ text: 'help                                  this list' },
	{
		text: 'users [text]                          list accounts, optionally by name, username or email start'
	},
	{ text: 'user <target>                         show one account' },
	{
		text: 'grant <target> <pro|ultimate> <time>  apply a plan; time = 12h, 30d, 8w, 6mo, 1y or permanent'
	},
	{ text: 'revoke <target>                       back to Free' },
	{ text: 'dev <target> <on|off>                 Developer badge' },
	{ text: 'audit [count]                         recent console changes' },
	{ text: 'clear                                 clear the screen', tone: 'muted' },
	{ text: 'target = @username or email address', tone: 'muted' }
];

/** '30d' → milliseconds; 'permanent' → null; anything else → undefined. */
export function parseDuration(s: string | undefined): number | null | undefined {
	if (!s) return undefined;
	if (/^(permanent|perm|forever)$/i.test(s)) return null;
	const m = /^(\d{1,5})(h|d|w|mo|y)$/i.exec(s);
	if (!m) return undefined;
	const unit = { h: HOUR, d: DAY, w: 7 * DAY, mo: 30 * DAY, y: 365 * DAY }[m[2].toLowerCase()]!;
	const ms = Number(m[1]) * unit;
	return ms > 0 && ms <= MAX_MS ? ms : undefined;
}

export function tokenize(input: string): string[] {
	return input.trim().split(/\s+/).filter(Boolean);
}

const when = (d: Date | string) =>
	new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

function describe(u: UserDoc): string {
	const t = tierInfo(effectiveTier(u)).label;
	const until =
		u.tierExpiresAt && effectiveTier(u) !== 'free' ? ` until ${when(u.tierExpiresAt)}` : '';
	const lapsed =
		u.tier && u.tier !== 'free' && effectiveTier(u) === 'free' ? ` (${u.tier} expired)` : '';
	return `${u.username ? '@' + u.username : '(no username)'}  ${u.email}  ${t}${until}${lapsed}${u.developer ? '  Developer' : ''}`;
}

async function find(ctx: Ctx, target: string | undefined): Promise<UserDoc> {
	if (!target) error(400, 'Give a target: @username or email.');
	const filter = target.startsWith('@')
		? { username: target.slice(1).toLowerCase() }
		: { email: target.toLowerCase() };
	const u = (await ctx.db.findOne('users', filter)) as UserDoc | null;
	if (!u) error(404, `No account matches ${target}.`);
	return u;
}

async function record(ctx: Ctx, actor: UserDoc, target: UserDoc, action: string) {
	await ctx.db.insertOne('audit', {
		_id: crypto.randomUUID(),
		at: new Date(),
		actorId: actor._id,
		actor: actor.username ?? actor.email,
		targetId: target._id,
		target: target.username ?? target.email,
		action
	});
}

/** Runs one console line. The caller has already confirmed `actor` is a Developer. */
export async function run(ctx: Ctx, actor: UserDoc, input: string): Promise<Line[]> {
	await limit(ctx.db, `console:${actor._id}`, 60, MIN);
	const [cmd, a, b, c] = tokenize(input);

	switch (cmd?.toLowerCase()) {
		case undefined:
			return [];
		case 'help':
			return HELP;

		case 'users': {
			const q = (a ?? '')
				.replace(/^@/, '')
				.toLowerCase()
				.replace(/[^a-z0-9_.@+-]/g, '');
			const safe = q.replace(/[.+]/g, '\\$&');
			const filter = q
				? { $or: [{ username: { $regex: `^${safe}` } }, { email: { $regex: `^${safe}` } }] }
				: {};
			const list = (await ctx.db.findMany('users', filter, {
				limit: 25,
				sort: { createdAt: -1 },
				projection: SAFE
			})) as unknown as UserDoc[];
			return list.length
				? list.map((u) => ({ text: describe(u) }))
				: [{ text: 'No accounts found.', tone: 'muted' }];
		}

		case 'user': {
			const u = await find(ctx, a);
			return [
				{ text: describe(u) },
				{
					text: `name ${u.name} · verified ${u.verified} · joined ${when(u.createdAt)}`,
					tone: 'muted'
				}
			];
		}

		case 'grant': {
			const tier = b?.toLowerCase() as Tier;
			if (tier !== 'pro' && tier !== 'ultimate') error(400, 'Plan must be pro or ultimate.');
			const span = parseDuration(c);
			if (span === undefined) error(400, 'Time must look like 12h, 30d, 8w, 6mo, 1y or permanent.');
			const u = await find(ctx, a);
			const tierExpiresAt = span === null ? null : new Date(Date.now() + span);
			await ctx.db.updateOne('users', { _id: u._id }, { $set: { tier, tierExpiresAt } });
			const label = span === null ? 'permanent' : `until ${when(tierExpiresAt!)}`;
			await record(ctx, actor, u, `grant ${tier} ${label}`);
			return [{ text: `${u.username ?? u.email}: ${TIERS[tier].label}, ${label}.`, tone: 'ok' }];
		}

		case 'revoke': {
			const u = await find(ctx, a);
			await ctx.db.updateOne(
				'users',
				{ _id: u._id },
				{ $set: { tier: 'free', tierExpiresAt: null } }
			);
			await record(ctx, actor, u, 'revoke');
			return [{ text: `${u.username ?? u.email}: back to Free.`, tone: 'ok' }];
		}

		case 'dev': {
			if (b !== 'on' && b !== 'off') error(400, 'Use: dev <target> on|off');
			const u = await find(ctx, a);
			if (u._id === actor._id && !dev)
				error(400, 'You can’t change your own Developer badge here.');
			await ctx.db.updateOne('users', { _id: u._id }, { $set: { developer: b === 'on' } });
			await record(ctx, actor, u, `developer ${b}`);
			return [{ text: `${u.username ?? u.email}: Developer ${b}.`, tone: 'ok' }];
		}

		case 'audit': {
			const n = Math.min(100, Math.max(1, Number(a) || 20));
			const list = await ctx.db.findMany('audit', {}, { limit: n, sort: { at: -1 } });
			return list.length
				? list.map((e) => ({
						text: `${when(e.at as Date)}  ${e.actor} → ${e.target}: ${e.action}`
					}))
				: [{ text: 'No changes yet.', tone: 'muted' }];
		}

		default:
			error(400, `Unknown command “${cmd.slice(0, 30)}”. Type help.`);
	}
}
