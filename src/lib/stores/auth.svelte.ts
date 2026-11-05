/**
 * Accounts live on the server (MongoDB, behind /api/auth). The session is an
 * httpOnly cookie the browser never reads; this store only mirrors who is
 * signed in and which step of a sign-in is pending.
 */
import type { Tier } from '../tiers.ts';
import { CHALLENGE_MESSAGE, connection } from './connection.svelte.ts';

export { PW_RULES, validEmail } from '../auth-rules.ts';

export interface User {
	id: string;
	name: string;
	email: string;
	username: string | null;
	tier: Tier;
	tierExpiresAt: string | null;
	developer: boolean;
}

export type Purpose = 'verify' | 'mfa';

export interface ApiResult<T = Record<string, unknown>> {
	ok: boolean;
	status: number;
	error?: string;
	data?: T;
	/** Cloudflare sent its "checking your browser" page instead of our API. */
	challenge?: boolean;
}

const TIMEOUT_MS = 20_000;

/** JSON request to our own API. Never throws: network failures come back as `ok: false`. */
export async function api<T = Record<string, unknown>>(
	method: string,
	path: string,
	body?: unknown
): Promise<ApiResult<T>> {
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: body === undefined ? {} : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (e) {
		const slow = e instanceof DOMException && e.name === 'TimeoutError';
		return {
			ok: false,
			status: 0,
			error: slow
				? 'Paceline took too long to answer. Try again in a moment.'
				: 'You’re offline. Check your connection and try again.'
		};
	}
	const json = (res.headers.get('content-type') ?? '').includes('application/json');
	// Our API always answers in JSON; an HTML 403 is Cloudflare's bot check.
	if (res.headers.get('cf-mitigated') === 'challenge' || (res.status === 403 && !json)) {
		connection.report('challenge');
		return { ok: false, status: res.status, challenge: true, error: CHALLENGE_MESSAGE };
	}
	connection.clear('challenge');
	const data = (json ? await res.json().catch(() => ({})) : {}) as T & { message?: string };
	if (res.ok) return { ok: true, status: res.status, data };
	return {
		ok: false,
		status: res.status,
		error:
			data?.message ??
			(res.status >= 500
				? `Paceline’s server didn’t answer properly (HTTP ${res.status}). Try again in a moment.`
				: `That didn’t work (HTTP ${res.status}). Try again.`),
		data
	};
}

/** Remove data this browser holds about the signed-in person (and the old local-mode keys). */
export function clearLocalData() {
	try {
		for (const k of Object.keys(localStorage))
			if (/^pl-(ws-cache:|ws:|accounts$|session$|trusted$|locks$|focus$|user$)/.test(k))
				localStorage.removeItem(k);
		sessionStorage.removeItem('pl-session');
	} catch {
		/* storage blocked */
	}
}

/** Local-mode leftovers from before accounts moved to the server, including password hashes. */
function clearLegacy() {
	try {
		for (const k of Object.keys(localStorage))
			if (/^pl-(ws:|accounts$|session$|trusted$|locks$)/.test(k)) localStorage.removeItem(k);
	} catch {
		/* storage blocked */
	}
}

interface CodeStep {
	needCode: true;
	purpose: Purpose;
	devCode?: string;
}

const USER_CACHE = 'pl-user';

function cachedUser(): User | null {
	try {
		return JSON.parse(localStorage.getItem(USER_CACHE) ?? 'null');
	} catch {
		return null;
	}
}

class Auth {
	#user = $state<User | null>(null);
	ready = $state(false);
	/** Couldn't reach the server at start-up, so we're running on the cached account. */
	offline = $state(false);

	get user() {
		return this.#user;
	}

	set user(u: User | null) {
		this.#user = u;
		if (u) connection.clear('signedOut');
		try {
			if (u) localStorage.setItem(USER_CACHE, JSON.stringify(u));
			else localStorage.removeItem(USER_CACHE);
		} catch {
			/* storage blocked */
		}
	}
	/** The sign-in waiting on a 6-digit code. */
	pending = $state<{ email: string; purpose: Purpose } | null>(null);
	/** Development only, when no email provider is set: the code to show on screen. */
	devCode = $state<string | null>(null);

	#init: Promise<void> | null = null;

	/** Ask the server who is signed in. Safe to call repeatedly. */
	init(): Promise<void> {
		clearLegacy();
		this.#init ??= this.refresh().then(() => {
			this.ready = true;
		});
		return this.#init;
	}

	/**
	 * Re-check the session. A clear "not signed in" ends it; a network problem or
	 * Cloudflare check keeps the last known account so the app can work from its cache.
	 */
	async refresh(): Promise<void> {
		const r = await api<{ user: User | null }>('GET', '/api/auth/me');
		if (r.ok) {
			this.offline = false;
			const u = r.data?.user ?? null;
			if (!u && this.#user && this.ready) {
				// Signed out elsewhere or the session ran out while this tab was open.
				connection.report('signedOut');
				return;
			}
			this.user = u;
			if (u) connection.clear('signedOut');
			return;
		}
		const known = this.#user ?? cachedUser();
		if (known) {
			this.#user = known;
			this.offline = true;
		}
	}

	#step(email: string, d: CodeStep) {
		this.pending = { email, purpose: d.purpose };
		this.devCode = d.devCode ?? null;
	}

	async signUp(name: string, email: string, password: string) {
		const r = await api<CodeStep>('POST', '/api/auth/signup', { name, email, password });
		if (r.ok && r.data) this.#step(email.trim().toLowerCase(), r.data);
		return r;
	}

	async signIn(email: string, password: string, remember: boolean) {
		const r = await api<{ user?: User } & Partial<CodeStep>>('POST', '/api/auth/signin', {
			email,
			password,
			remember
		});
		if (r.ok && r.data?.user) this.user = r.data.user;
		else if (r.ok && r.data?.needCode) this.#step(email.trim().toLowerCase(), r.data as CodeStep);
		return { ...r, needCode: !!r.data?.needCode, purpose: r.data?.purpose };
	}

	async verifyCode(code: string) {
		if (!this.pending) return { ok: false, status: 400, error: 'Start again.' } as ApiResult;
		const r = await api<{ user: User; created: boolean }>('POST', '/api/auth/verify', {
			...this.pending,
			code
		});
		if (r.ok && r.data) {
			this.user = r.data.user;
			this.pending = null;
			this.devCode = null;
		}
		return r;
	}

	async resend() {
		if (!this.pending) return;
		const r = await api<Partial<CodeStep>>('POST', '/api/auth/resend', this.pending);
		if (r.data?.devCode) this.devCode = r.data.devCode;
		return r;
	}

	requestReset(email: string) {
		return api('POST', '/api/auth/reset/request', { email });
	}

	resetPassword(token: string, password: string) {
		return api('POST', '/api/auth/reset/confirm', { token, password });
	}

	/** Claim the permanent username. */
	async setUsername(username: string) {
		const r = await api<{ user: User }>('POST', '/api/account/username', { username });
		if (r.ok && r.data) this.user = r.data.user;
		return r;
	}

	async rename(name: string) {
		const r = await api<{ user: User }>('PATCH', '/api/account', { name });
		if (r.ok && r.data) this.user = r.data.user;
		return r;
	}

	async deleteAccount() {
		const r = await api('DELETE', '/api/account', {});
		if (r.ok) {
			this.user = null;
			clearLocalData();
		}
		return r;
	}

	async signOut() {
		await api('POST', '/api/auth/signout', {});
		clearLocalData();
		this.user = null;
		this.pending = null;
		this.devCode = null;
	}

	cancelPending() {
		this.pending = null;
		this.devCode = null;
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
