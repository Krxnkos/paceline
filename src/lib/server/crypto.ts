/**
 * Password hashing and tokens on WebCrypto, so the same code runs in Node (dev)
 * and on Cloudflare Workers (prod).
 *
 * Passwords: PBKDF2-SHA256 over HMAC-SHA256(pepper, password). The pepper is a
 * Worker secret that never touches the database, so a leaked users collection
 * can't be brute-forced offline. Iterations are stored per hash and raised on
 * the next sign-in when the configured count goes up.
 */

const enc = new TextEncoder();

export interface PasswordHash {
	alg: 'pbkdf2-sha256-peppered';
	iter: number;
	salt: string;
	hash: string;
}

/** Workers caps PBKDF2 at 100,000 iterations. */
export const MAX_ITERATIONS = 100_000;

export function b64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
	return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text: string): Promise<string> {
	return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

/** Uniform 6-digit code (rejection sampling, no modulo bias). */
export function sixDigitCode(): string {
	const max = 4_294_000_000; // largest multiple of 1e6 below 2^32
	for (;;) {
		const n = crypto.getRandomValues(new Uint32Array(1))[0];
		if (n < max) return String(n % 1_000_000).padStart(6, '0');
	}
}

export function safeEqual(a: string, b: string): boolean {
	const x = enc.encode(a);
	const y = enc.encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

async function derive(password: string, pepper: string, salt: Uint8Array, iter: number) {
	const hmacKey = await crypto.subtle.importKey(
		'raw',
		enc.encode(pepper),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const peppered = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(password));
	const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
		key,
		256
	);
	return b64url(new Uint8Array(bits));
}

export async function hashPassword(
	password: string,
	pepper: string,
	iter: number
): Promise<PasswordHash> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const n = Math.min(MAX_ITERATIONS, Math.max(10_000, Math.floor(iter)));
	return {
		alg: 'pbkdf2-sha256-peppered',
		iter: n,
		salt: b64url(salt),
		hash: await derive(password, pepper, salt, n)
	};
}

export async function verifyPassword(
	password: string,
	stored: PasswordHash,
	pepper: string
): Promise<boolean> {
	const got = await derive(password, pepper, fromB64url(stored.salt), stored.iter);
	return safeEqual(got, stored.hash);
}

/** A fixed hash to verify against when the account doesn't exist, so timing doesn't reveal it. */
export const DUMMY_HASH: PasswordHash = {
	alg: 'pbkdf2-sha256-peppered',
	iter: 60_000,
	salt: 'AAAAAAAAAAAAAAAAAAAAAA',
	hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
};
