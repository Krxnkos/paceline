import { dev } from '$app/env';
import { error, type Cookies } from '@sveltejs/kit';
import type { Gateway } from './gateway.ts';
import type { Config } from './config.ts';
import {
	DUMMY_HASH,
	hashPassword,
	randomToken,
	safeEqual,
	sha256,
	sixDigitCode,
	verifyPassword,
	type PasswordHash
} from './crypto.ts';
import { clear, count, hit, limit } from './limits.ts';
import { codeMail, existsMail, resetMail, send } from './email.ts';

const MIN = 60_000;
const DAY = 86_400_000;

export const SESSION_COOKIE = dev ? 'pl_session' : '__Host-pl_session';
export const DEVICE_COOKIE = dev ? 'pl_device' : '__Host-pl_device';

export interface UserDoc {
	_id: string;
	email: string;
	name: string;
	pwd: PasswordHash;
	verified: boolean;
	createdAt: Date;
	trusted: { h: string; exp: Date }[];
}

export interface PublicUser {
	id: string;
	name: string;
	email: string;
}

export const publicUser = (u: UserDoc): PublicUser => ({ id: u._id, name: u.name, email: u.email });

export interface Ctx {
	db: Gateway;
	cfg: Config;
	cookies: Cookies;
	ip: string;
	origin: string;
}

type CodeResult = { ok: true; needCode: true; purpose: 'verify' | 'mfa'; devCode?: string };

const cookieBase = { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax' as const };

// ── Sessions ────────────────────────────────────────────────

async function startSession(ctx: Ctx, user: UserDoc, remember: boolean) {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + (remember ? 30 * DAY : DAY / 2));
	await ctx.db.insertOne('sessions', {
		_id: await sha256(token),
		userId: user._id,
		expiresAt,
		createdAt: new Date()
	});
	ctx.cookies.set(
		SESSION_COOKIE,
		token,
		remember ? { ...cookieBase, expires: expiresAt } : cookieBase
	);
}

export async function currentUser(db: Gateway, cookies: Cookies): Promise<UserDoc | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token || token.length > 64) return null;
	const s = await db.findOne('sessions', {
		_id: await sha256(token),
		expiresAt: { $gt: new Date() }
	});
	if (!s) return null;
	return (await db.findOne('users', { _id: s.userId as string })) as UserDoc | null;
}

export async function signOut(ctx: Ctx) {
	const token = ctx.cookies.get(SESSION_COOKIE);
	if (token && token.length <= 64)
		await ctx.db.deleteMany('sessions', { _id: await sha256(token) });
	ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ── Trusted devices ─────────────────────────────────────────

async function deviceHash(ctx: Ctx): Promise<string | null> {
	const id = ctx.cookies.get(DEVICE_COOKIE);
	return id && id.length <= 64 ? sha256(id) : null;
}

async function isTrusted(ctx: Ctx, user: UserDoc) {
	const h = await deviceHash(ctx);
	return !!h && (user.trusted ?? []).some((t) => t.h === h && new Date(t.exp) > new Date());
}

async function trustDevice(ctx: Ctx, user: UserDoc) {
	let id = ctx.cookies.get(DEVICE_COOKIE);
	if (!id || id.length > 64) {
		id = randomToken();
		ctx.cookies.set(DEVICE_COOKIE, id, {
			...cookieBase,
			expires: new Date(Date.now() + 365 * DAY)
		});
	}
	const h = await sha256(id);
	const now = new Date();
	const trusted = (user.trusted ?? []).filter((t) => t.h !== h && new Date(t.exp) > now).slice(-9);
	trusted.push({ h, exp: new Date(Date.now() + 30 * DAY) });
	await ctx.db.updateOne('users', { _id: user._id }, { $set: { trusted } });
}

// ── One-time codes ──────────────────────────────────────────

const codeHash = (cfg: Config, userId: string, code: string) =>
	sha256(`${cfg.pepper}:${userId}:${code}`);

async function issueCode(
	ctx: Ctx,
	user: UserDoc,
	purpose: 'verify' | 'mfa',
	remember: boolean
): Promise<CodeResult> {
	const code = sixDigitCode();
	await ctx.db.updateOne(
		'codes',
		{ _id: `${purpose}:${user._id}` },
		{
			$set: {
				userId: user._id,
				hash: await codeHash(ctx.cfg, user._id, code),
				attempts: 0,
				remember,
				expiresAt: new Date(Date.now() + 10 * MIN)
			}
		},
		true
	);
	await send(ctx.cfg, codeMail(user.email, code, purpose));
	return {
		ok: true,
		needCode: true,
		purpose,
		...(ctx.cfg.dev && !ctx.cfg.resendKey ? { devCode: code } : {})
	};
}

// ── Flows ───────────────────────────────────────────────────

export async function signUp(
	ctx: Ctx,
	name: string,
	email: string,
	password: string
): Promise<CodeResult> {
	await limit(ctx.db, `signup:ip:${ctx.ip}`, 10, 60 * MIN);
	if (!ctx.cfg.signupOpen(email))
		error(403, 'Sign-up is invite-only. Ask the owner to add your email.');

	const existing = (await ctx.db.findOne('users', { email })) as UserDoc | null;
	if (existing?.verified) {
		// Same answer as a new sign-up, so the form can't be used to find accounts.
		await send(ctx.cfg, existsMail(email, ctx.origin));
		return { ok: true, needCode: true, purpose: 'verify' };
	}
	const pwd = await hashPassword(password, ctx.cfg.pepper, ctx.cfg.iterations);
	let user: UserDoc;
	if (existing) {
		await ctx.db.updateOne('users', { _id: existing._id }, { $set: { name, pwd } });
		user = { ...existing, name, pwd };
	} else {
		user = {
			_id: crypto.randomUUID(),
			email,
			name,
			pwd,
			verified: false,
			createdAt: new Date(),
			trusted: []
		};
		const r = await ctx.db.insertOne('users', user);
		if (!r.ok) error(409, 'Try again in a moment.');
	}
	return issueCode(ctx, user, 'verify', true);
}

export async function signIn(
	ctx: Ctx,
	email: string,
	password: string,
	remember: boolean
): Promise<{ ok: true; user: PublicUser } | CodeResult> {
	await limit(ctx.db, `signin:ip:${ctx.ip}`, 30, 15 * MIN);
	const failKey = `fail:${email}`;
	if ((await count(ctx.db, failKey, 15 * MIN)) >= 5)
		error(429, 'Too many wrong tries. Try again in 15 minutes.');

	const user = (await ctx.db.findOne('users', { email })) as UserDoc | null;
	const ok = await verifyPassword(password, user?.pwd ?? DUMMY_HASH, ctx.cfg.pepper);
	if (!user || !ok) {
		await hit(ctx.db, failKey, 15 * MIN);
		error(401, 'That email and password don’t match.');
	}
	await clear(ctx.db, failKey, 15 * MIN);

	// Upgrade old hashes when the iteration count goes up.
	if (user.pwd.iter < Math.min(ctx.cfg.iterations, 100_000))
		await ctx.db.updateOne(
			'users',
			{ _id: user._id },
			{ $set: { pwd: await hashPassword(password, ctx.cfg.pepper, ctx.cfg.iterations) } }
		);

	if (!user.verified) return issueCode(ctx, user, 'verify', remember);
	if (await isTrusted(ctx, user)) {
		await startSession(ctx, user, remember);
		return { ok: true, user: publicUser(user) };
	}
	return issueCode(ctx, user, 'mfa', remember);
}

export async function verify(ctx: Ctx, email: string, purpose: 'verify' | 'mfa', code: string) {
	await limit(ctx.db, `verify:ip:${ctx.ip}`, 30, 15 * MIN);
	const user = (await ctx.db.findOne('users', { email })) as UserDoc | null;
	const doc = user
		? await ctx.db.findOne('codes', {
				_id: `${purpose}:${user._id}`,
				expiresAt: { $gt: new Date() }
			})
		: null;
	if (!user || !doc) error(400, 'That code has expired. Request a new one.');

	const attempts = ((doc.attempts as number) ?? 0) + 1;
	if (attempts > 5) {
		await ctx.db.deleteMany('codes', { _id: doc._id });
		error(400, 'Too many wrong codes. Request a new one.');
	}
	if (!safeEqual(await codeHash(ctx.cfg, user._id, code), doc.hash as string)) {
		await ctx.db.updateOne('codes', { _id: doc._id }, { $set: { attempts } });
		error(400, 'That code isn’t right. Check it and try again.');
	}
	await ctx.db.deleteMany('codes', { _id: doc._id });
	if (!user.verified)
		await ctx.db.updateOne('users', { _id: user._id }, { $set: { verified: true } });
	const remember = doc.remember !== false;
	if (remember) await trustDevice(ctx, user);
	await startSession(ctx, user, remember);
	return { ok: true as const, user: publicUser(user), created: purpose === 'verify' };
}

export async function resend(ctx: Ctx, email: string, purpose: 'verify' | 'mfa') {
	await limit(ctx.db, `resend:${email}`, 3, 10 * MIN);
	const user = (await ctx.db.findOne('users', { email })) as UserDoc | null;
	const doc = user ? await ctx.db.findOne('codes', { _id: `${purpose}:${user._id}` }) : null;
	// Only re-send for a sign-in that is actually in progress.
	if (!user || !doc) return { ok: true as const };
	return issueCode(ctx, user, purpose, doc.remember !== false);
}

export async function requestReset(ctx: Ctx, email: string) {
	await limit(ctx.db, `reset:ip:${ctx.ip}`, 5, 15 * MIN);
	await limit(ctx.db, `reset:${email}`, 3, 60 * MIN);
	const user = (await ctx.db.findOne('users', { email })) as UserDoc | null;
	if (user) {
		const token = randomToken();
		await ctx.db.deleteMany('codes', { userId: user._id, kind: 'reset' });
		await ctx.db.insertOne('codes', {
			_id: `reset:${await sha256(token)}`,
			kind: 'reset',
			userId: user._id,
			expiresAt: new Date(Date.now() + 30 * MIN)
		});
		await send(ctx.cfg, resetMail(user.email, `${ctx.origin}/reset?token=${token}`));
	}
	// Never confirm whether an address is registered.
	return { ok: true as const };
}

export async function confirmReset(ctx: Ctx, token: string, password: string) {
	await limit(ctx.db, `reset-confirm:ip:${ctx.ip}`, 10, 15 * MIN);
	const doc = await ctx.db.findOne('codes', {
		_id: `reset:${await sha256(token)}`,
		expiresAt: { $gt: new Date() }
	});
	if (!doc) error(400, 'That reset link has expired. Request a new one.');
	const user = (await ctx.db.findOne('users', { _id: doc.userId as string })) as UserDoc | null;
	if (!user) error(400, 'That reset link has expired. Request a new one.');
	await ctx.db.deleteMany('codes', { _id: doc._id });
	await ctx.db.updateOne(
		'users',
		{ _id: user._id },
		{
			$set: {
				pwd: await hashPassword(password, ctx.cfg.pepper, ctx.cfg.iterations),
				verified: true,
				trusted: []
			}
		}
	);
	// Sign out everywhere.
	await ctx.db.deleteMany('sessions', { userId: user._id });
	await clear(ctx.db, `fail:${user.email}`, 15 * MIN);
	return { ok: true as const };
}

export async function deleteAccount(ctx: Ctx, user: UserDoc) {
	await Promise.all([
		ctx.db.deleteMany('workspaces', { _id: user._id }),
		ctx.db.deleteMany('sessions', { userId: user._id }),
		ctx.db.deleteMany('codes', { userId: user._id })
	]);
	await ctx.db.deleteMany('users', { _id: user._id });
	ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
}
