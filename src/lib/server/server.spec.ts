import { describe, expect, it } from 'vitest';
import {
	hashPassword,
	MAX_ITERATIONS,
	randomToken,
	safeEqual,
	sha256,
	sixDigitCode,
	verifyPassword
} from './crypto.ts';
import * as v from './validate.ts';
import { checkUsername } from './username.ts';
import { parseDuration, tokenize } from './console.ts';
import { effectiveTier } from '../tiers.ts';

const PEPPER = 'p'.repeat(48);

describe('passwords', () => {
	it('verifies the right password and rejects others', async () => {
		const h = await hashPassword('Correct-Horse-9', PEPPER, 20_000);
		expect(h.alg).toBe('pbkdf2-sha256-peppered');
		expect(await verifyPassword('Correct-Horse-9', h, PEPPER)).toBe(true);
		expect(await verifyPassword('Correct-Horse-8', h, PEPPER)).toBe(false);
	});

	it('is useless without the pepper', async () => {
		const h = await hashPassword('Correct-Horse-9', PEPPER, 20_000);
		expect(await verifyPassword('Correct-Horse-9', h, 'q'.repeat(48))).toBe(false);
	});

	it('salts every hash', async () => {
		const a = await hashPassword('same', PEPPER, 10_000);
		const b = await hashPassword('same', PEPPER, 10_000);
		expect(a.salt).not.toBe(b.salt);
		expect(a.hash).not.toBe(b.hash);
	});

	it('keeps iterations within what Workers allows', async () => {
		expect((await hashPassword('x', PEPPER, 5_000_000)).iter).toBe(MAX_ITERATIONS);
		expect((await hashPassword('x', PEPPER, 10)).iter).toBe(10_000);
	});
});

describe('tokens and codes', () => {
	it('makes 6-digit codes', () => {
		for (let i = 0; i < 200; i++) expect(sixDigitCode()).toMatch(/^\d{6}$/);
	});

	it('makes unguessable url-safe tokens', () => {
		const t = randomToken();
		expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(randomToken()).not.toBe(t);
	});

	it('compares in constant shape', async () => {
		expect(safeEqual('abc', 'abc')).toBe(true);
		expect(safeEqual('abc', 'abd')).toBe(false);
		expect(safeEqual('abc', 'abcd')).toBe(false);
		expect(await sha256('x')).toBe(await sha256('x'));
	});
});

describe('validation', () => {
	const ws = {
		tasks: [],
		projects: [],
		meetings: [],
		goals: [],
		settings: {},
		nextCode: 1,
		nextProjectCode: 1
	};
	const status = (fn: () => unknown) => {
		try {
			fn();
			return 200;
		} catch (e) {
			return (e as { status: number }).status;
		}
	};

	it('rejects non-string emails (no operator injection)', () => {
		expect(status(() => v.email({ $ne: null }))).toBe(400);
		expect(status(() => v.email('Someone@Example.com'))).toBe(200);
		expect(v.email(' Someone@Example.com ')).toBe('someone@example.com');
	});

	it('enforces the password rules on sign-up only', () => {
		expect(status(() => v.password('short', false))).toBe(400);
		expect(status(() => v.password('longenough', false))).toBe(200);
		expect(status(() => v.password('longenough', true))).toBe(400);
		expect(status(() => v.password('Long-enough-1', true))).toBe(200);
		expect(status(() => v.password('x'.repeat(201), false))).toBe(400);
	});

	it('accepts a well-formed workspace', () => {
		expect(status(() => v.workspace({ ...ws, tasks: [{ title: '$100 invoice' }] }))).toBe(200);
	});

	it('rejects operator or dotted keys anywhere in a workspace', () => {
		expect(status(() => v.workspace({ ...ws, tasks: [{ $where: '1' }] }))).toBe(400);
		expect(status(() => v.workspace({ ...ws, settings: { 'a.b': 1 } }))).toBe(400);
		expect(status(() => v.workspace({ ...ws, tasks: 'nope' }))).toBe(400);
	});

	it('accepts only well-formed codes and tokens', () => {
		expect(status(() => v.code('12345'))).toBe(400);
		expect(status(() => v.code('123456'))).toBe(200);
		expect(status(() => v.token('short'))).toBe(400);
		expect(status(() => v.token(randomToken()))).toBe(200);
	});
});

describe('usernames', () => {
	const ok = (s: unknown) => checkUsername(s).ok;

	it('accepts normal names and stores them lower-case', () => {
		expect(checkUsername('@Krxn_07')).toEqual({ ok: true, username: 'krxn_07' });
		expect(ok('cassie')).toBe(true);
		expect(ok('dickens')).toBe(true);
	});

	it('rejects bad formats', () => {
		for (const s of ['ab', '1abc', 'has space', 'a'.repeat(21), 'semi;colon', '', 42])
			expect(ok(s)).toBe(false);
	});

	it('rejects reserved names', () => {
		for (const s of ['admin', 'Paceline', 'support', 'moderator']) expect(ok(s)).toBe(false);
	});

	it('rejects offensive names, however they are disguised', () => {
		for (const s of ['fuck3r', 'f_u_c_k', 'sh1t', 'b1tch', 'h1tler', 'n_a_z_i'])
			expect(ok(s)).toBe(false);
	});
});

describe('subscriptions', () => {
	it('falls back to Free when a timed plan runs out', () => {
		const past = new Date(Date.now() - 1000);
		const future = new Date(Date.now() + 60_000);
		expect(effectiveTier({ tier: 'pro', tierExpiresAt: past })).toBe('free');
		expect(effectiveTier({ tier: 'pro', tierExpiresAt: future })).toBe('pro');
		expect(effectiveTier({ tier: 'ultimate', tierExpiresAt: null })).toBe('ultimate');
		expect(effectiveTier({ tier: 'nonsense' })).toBe('free');
		expect(effectiveTier({})).toBe('free');
	});

	it('reads console durations', () => {
		expect(parseDuration('12h')).toBe(43_200_000);
		expect(parseDuration('30d')).toBe(2_592_000_000);
		expect(parseDuration('permanent')).toBeNull();
		expect(parseDuration('soon')).toBeUndefined();
		expect(parseDuration('0d')).toBeUndefined();
		expect(parseDuration('99999y')).toBeUndefined();
		expect(tokenize('  grant  @a pro  30d ')).toEqual(['grant', '@a', 'pro', '30d']);
	});
});
