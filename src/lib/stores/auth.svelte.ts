/**
 * Local-mode authentication.
 *
 * Accounts live in this browser only. Passwords are salted and hashed with
 * PBKDF2 (WebCrypto) and never stored in plain text. There is no email server,
 * so one-time codes are shown on screen ("local mode"). The public API mirrors
 * what a hosted provider (Supabase, see README) would expose, so swapping the
 * internals later doesn't touch the screens.
 */

export interface User {
	id: string;
	name: string;
	email: string;
}

interface Account extends User {
	salt: string;
	hash: string;
	verified: boolean;
	createdAt: string;
}

interface Session {
	userId: string;
	expires: number;
}

type Pending =
	| { kind: 'verify'; userId: string; code: string; remember: boolean }
	| { kind: 'mfa'; userId: string; code: string; remember: boolean }
	| { kind: 'reset'; userId: string; code: string };

const ACCOUNTS = 'pl-accounts';
const SESSION = 'pl-session';
const TRUST = 'pl-trusted';
const LOCKS = 'pl-locks';
const DAY = 86_400_000;

export const PW_RULES = [
	{ label: '12+ characters', test: (p: string) => p.length >= 12 },
	{ label: 'A number', test: (p: string) => /\d/.test(p) },
	{ label: 'Upper + lower case', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
	{ label: 'A symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) }
];

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

function read<T>(store: Storage | undefined, key: string, fallback: T): T {
	try {
		const raw = store?.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function write(store: Storage | undefined, key: string, value: unknown) {
	try {
		if (value === null) store?.removeItem(key);
		else store?.setItem(key, JSON.stringify(value));
	} catch {
		/* storage blocked */
	}
}

const ls = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
const ss = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage);

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function hashPassword(password: string, salt: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210_000 },
		key,
		256
	);
	return b64(bits);
}

function sixDigits(): string {
	const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
	return String(n).padStart(6, '0');
}

function uuid(): string {
	return crypto.randomUUID();
}

export type SignInResult =
	{ ok: true; needCode: boolean } | { ok: false; error: string; field?: 'email' | 'pw' };

class Auth {
	user = $state<User | null>(null);
	ready = $state(false);
	pending = $state<Pending | null>(null);
	/** The code to show on screen while there's no email server. */
	localCode = $derived(this.pending?.code ?? null);

	init() {
		if (this.ready) return;
		const s =
			read<Session | null>(ls(), SESSION, null) ?? read<Session | null>(ss(), SESSION, null);
		if (s && s.expires > Date.now()) {
			const a = this.#accounts().find((x) => x.id === s.userId);
			if (a) this.user = { id: a.id, name: a.name, email: a.email };
		}
		this.ready = true;
	}

	#accounts(): Account[] {
		return read<Account[]>(ls(), ACCOUNTS, []);
	}

	#save(accounts: Account[]) {
		write(ls(), ACCOUNTS, accounts);
	}

	#find(email: string) {
		return this.#accounts().find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
	}

	#lock(email: string): number {
		const locks = read<Record<string, { n: number; until: number }>>(ls(), LOCKS, {});
		const l = locks[email.toLowerCase()];
		return l && l.until > Date.now() ? l.until : 0;
	}

	#fail(email: string) {
		const locks = read<Record<string, { n: number; until: number }>>(ls(), LOCKS, {});
		const k = email.toLowerCase();
		const l = locks[k] ?? { n: 0, until: 0 };
		l.n += 1;
		if (l.n >= 5) {
			l.until = Date.now() + 15 * 60_000;
			l.n = 0;
		}
		locks[k] = l;
		write(ls(), LOCKS, locks);
	}

	#clearFails(email: string) {
		const locks = read<Record<string, unknown>>(ls(), LOCKS, {});
		delete locks[email.toLowerCase()];
		write(ls(), LOCKS, locks);
	}

	#trusted(userId: string) {
		const t = read<Record<string, number>>(ls(), TRUST, {});
		return (t[userId] ?? 0) > Date.now();
	}

	#start(a: Account, remember: boolean) {
		const session: Session = { userId: a.id, expires: Date.now() + 30 * DAY };
		write(ls(), SESSION, null);
		write(ss(), SESSION, null);
		write(remember ? ls() : ss(), SESSION, session);
		if (remember) {
			const t = read<Record<string, number>>(ls(), TRUST, {});
			t[a.id] = Date.now() + 30 * DAY;
			write(ls(), TRUST, t);
		}
		this.user = { id: a.id, name: a.name, email: a.email };
		this.pending = null;
	}

	async signUp(
		name: string,
		email: string,
		password: string
	): Promise<{ ok: boolean; error?: string }> {
		if (this.#find(email))
			return { ok: false, error: 'An account with that email already exists. Sign in instead.' };
		const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
		const a: Account = {
			id: uuid(),
			name: name.trim(),
			email: email.trim(),
			salt,
			hash: await hashPassword(password, salt),
			verified: false,
			createdAt: new Date().toISOString()
		};
		this.#save([...this.#accounts(), a]);
		this.pending = { kind: 'verify', userId: a.id, code: sixDigits(), remember: true };
		return { ok: true };
	}

	async signIn(email: string, password: string, remember: boolean): Promise<SignInResult> {
		const until = this.#lock(email);
		if (until) {
			const mins = Math.ceil((until - Date.now()) / 60_000);
			return {
				ok: false,
				error: `Too many tries. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
				field: 'pw'
			};
		}
		const a = this.#find(email);
		const hash = a ? await hashPassword(password, a.salt) : null;
		if (!a || hash !== a.hash) {
			this.#fail(email);
			return { ok: false, error: 'That email and password don’t match.', field: 'pw' };
		}
		this.#clearFails(email);
		if (a.verified && this.#trusted(a.id)) {
			this.#start(a, remember);
			return { ok: true, needCode: false };
		}
		this.pending = {
			kind: a.verified ? 'mfa' : 'verify',
			userId: a.id,
			code: sixDigits(),
			remember
		};
		return { ok: true, needCode: true };
	}

	verifyCode(code: string): { ok: boolean; error?: string } {
		const p = this.pending;
		if (!p || p.kind === 'reset')
			return { ok: false, error: 'That code has expired. Start again.' };
		if (code !== p.code)
			return { ok: false, error: 'That code isn’t right. Check it and try again.' };
		const accounts = this.#accounts();
		const a = accounts.find((x) => x.id === p.userId);
		if (!a) return { ok: false, error: 'Account not found.' };
		a.verified = true;
		this.#save(accounts);
		this.#start(a, p.remember);
		return { ok: true };
	}

	resend() {
		if (this.pending) this.pending = { ...this.pending, code: sixDigits() };
	}

	/** Always succeeds, so nobody can probe which emails are registered. */
	requestReset(email: string) {
		const a = this.#find(email);
		this.pending = a ? { kind: 'reset', userId: a.id, code: sixDigits() } : null;
	}

	async resetPassword(code: string, password: string): Promise<{ ok: boolean; error?: string }> {
		const p = this.pending;
		if (!p || p.kind !== 'reset' || p.code !== code)
			return { ok: false, error: 'That reset link has expired.' };
		const accounts = this.#accounts();
		const a = accounts.find((x) => x.id === p.userId);
		if (!a) return { ok: false, error: 'Account not found.' };
		a.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
		a.hash = await hashPassword(password, a.salt);
		a.verified = true;
		this.#save(accounts);
		this.#clearFails(a.email);
		this.pending = null;
		return { ok: true };
	}

	rename(name: string) {
		if (!this.user) return;
		const accounts = this.#accounts();
		const a = accounts.find((x) => x.id === this.user!.id);
		if (!a) return;
		a.name = name.trim();
		this.#save(accounts);
		this.user = { ...this.user, name: a.name };
	}

	deleteAccount() {
		if (!this.user) return;
		const id = this.user.id;
		this.#save(this.#accounts().filter((a) => a.id !== id));
		write(ls(), `pl-ws:${id}`, null);
		this.signOut();
	}

	signOut() {
		write(ls(), SESSION, null);
		write(ss(), SESSION, null);
		this.user = null;
		this.pending = null;
	}
}

export const auth = new Auth();

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	return (
		(
			(parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : (parts[0]?.[1] ?? ''))
		).toUpperCase() || '··'
	);
}

export function shortName(name: string): string {
	const parts = name.trim().split(/\s+/);
	return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : (parts[0] ?? '');
}
