import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional string: read from Worker vars/secrets in production and from .env in development. */
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	/** Secret mixed into every password hash. Set with `wrangler secret put PASSWORD_PEPPER`. */
	PASSWORD_PEPPER: { schema: optional },
	/** Resend API key for sign-up codes and reset links. */
	RESEND_API_KEY: { schema: optional },
	/** Comma-separated emails allowed to create an account. */
	SIGNUP_ALLOWLIST: { schema: optional },
	EMAIL_FROM: { schema: optional },
	PUBLIC_ORIGIN: { schema: optional },
	PBKDF2_ITERATIONS: { schema: optional },
	/** Development only; production reaches MongoDB through the paceline-db Worker. */
	MONGODB_URI: { schema: optional }
});
