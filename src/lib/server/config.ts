import { dev } from '$app/env';
import {
	PASSWORD_PEPPER,
	PBKDF2_ITERATIONS,
	SIGNUP_ALLOWLIST,
	RESEND_API_KEY,
	EMAIL_FROM,
	PUBLIC_ORIGIN
} from '$app/env/private';
import { error } from '@sveltejs/kit';

/** Server configuration from Worker vars/secrets (prod) or .env (dev). */
export function config() {
	const pepper = PASSWORD_PEPPER || (dev ? 'dev-only-pepper-not-for-production' : '');
	if (!pepper || pepper.length < 32) {
		if (!dev) error(503, 'Paceline is not configured yet (PASSWORD_PEPPER).');
	}
	const iterations = Number(PBKDF2_ITERATIONS) || 60_000;
	const allowlist = (SIGNUP_ALLOWLIST ?? '')
		.split(/[\s,]+/)
		.map((e: string) => e.trim().toLowerCase())
		.filter(Boolean);
	return {
		dev,
		pepper,
		iterations,
		allowlist,
		/** Sign-up stays closed in production until an allowlist is set. Dev allows anyone. */
		signupOpen: (email: string) => (allowlist.length ? allowlist.includes(email) : dev),
		resendKey: RESEND_API_KEY ?? '',
		emailFrom: EMAIL_FROM || 'Paceline <no-reply@krxnkos.xyz>',
		origin: PUBLIC_ORIGIN || ''
	};
}

export type Config = ReturnType<typeof config>;
