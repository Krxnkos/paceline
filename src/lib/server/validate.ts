import { error } from '@sveltejs/kit';
import { PW_RULES } from '../auth-rules.ts';

/** Request-body readers. Every value that reaches a Mongo filter passes through these. */

export async function body(request: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
	const len = Number(request.headers.get('content-length') ?? 0);
	if (len > maxBytes) error(413, 'Request too large.');
	const text = await request.text();
	if (text.length > maxBytes) error(413, 'Request too large.');
	try {
		const v = JSON.parse(text);
		if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
		return v as Record<string, unknown>;
	} catch {
		error(400, 'Invalid JSON.');
	}
}

export function str(v: unknown, field: string, max = 200): string {
	if (typeof v !== 'string') error(400, `${field} is required.`);
	const s = v.trim();
	if (!s || s.length > max) error(400, `${field} is invalid.`);
	return s;
}

export function email(v: unknown): string {
	const s = str(v, 'Email', 254).toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) error(400, 'Enter a valid email address.');
	return s;
}

/** Passwords are not trimmed; length is bounded so hashing cost stays fixed. */
export function password(v: unknown, strict: boolean): string {
	if (typeof v !== 'string' || v.length < 8 || v.length > 200)
		error(400, 'Your password is at least 8 characters.');
	if (strict && !PW_RULES.every((r) => r.test(v)))
		error(400, 'Meet all four rules to keep your plans safe.');
	return v;
}

export function code(v: unknown): string {
	if (typeof v !== 'string' || !/^\d{6}$/.test(v)) error(400, 'Enter all 6 digits.');
	return v;
}

export function purpose(v: unknown): 'verify' | 'mfa' {
	if (v !== 'verify' && v !== 'mfa') error(400, 'Invalid request.');
	return v;
}

export function token(v: unknown): string {
	if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(v))
		error(400, 'That reset link is invalid.');
	return v;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Shape check for a saved workspace. The contents are the person's own data and
 * are only ever rendered as text, so this guards structure and size, not values.
 */
export function workspace(v: unknown): Record<string, unknown> {
	if (!isObj(v)) error(400, 'Invalid workspace.');
	for (const k of ['tasks', 'projects', 'meetings', 'goals'] as const) {
		const a = v[k];
		if (!Array.isArray(a) || a.length > 10_000 || !a.every(isObj))
			error(400, `Invalid workspace (${k}).`);
	}
	if (!isObj(v.settings)) error(400, 'Invalid workspace (settings).');
	for (const k of ['nextCode', 'nextProjectCode'] as const)
		if (typeof v[k] !== 'number' || !Number.isFinite(v[k])) error(400, `Invalid workspace (${k}).`);
	if (!safeKeys(v)) error(400, 'Invalid workspace (reserved keys).');
	return v;
}

/** No `$`-prefixed or dotted keys anywhere, so stored data can never read as a MongoDB operator. */
function safeKeys(v: unknown, depth = 0): boolean {
	if (depth > 12) return false;
	if (Array.isArray(v)) return v.every((x) => safeKeys(x, depth + 1));
	if (!isObj(v)) return true;
	return Object.entries(v).every(
		([k, x]) => !k.startsWith('$') && !k.includes('.') && safeKeys(x, depth + 1)
	);
}
