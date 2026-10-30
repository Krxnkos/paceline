import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { getDb } from '#lib/server/db.ts';
import { currentUser, SESSION_COOKIE } from '#lib/server/auth.ts';

const MAX_API_BODY = 1_500_000;

export const handle: Handle = async ({ event, resolve }) => {
	const api = event.url.pathname.startsWith('/api/');
	event.locals.user = null;

	if (api) {
		// CSRF: state-changing API calls must come from this origin, as JSON.
		if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
			const origin = event.request.headers.get('origin');
			if (origin !== event.url.origin) return json403('Cross-site request blocked.');
			if (!(event.request.headers.get('content-type') ?? '').startsWith('application/json'))
				return json403('Expected JSON.');
			if (Number(event.request.headers.get('content-length') ?? 0) > MAX_API_BODY)
				return new Response(JSON.stringify({ message: 'Request too large.' }), { status: 413 });
		}
		if (event.cookies.get(SESSION_COOKIE)) {
			event.locals.user = await currentUser(await getDb(), event.cookies);
		}
	}

	// CSP for pages comes from kit.csp in vite.config.ts (it needs per-response nonces).
	const response = await resolve(event);
	const h = response.headers;
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('X-Frame-Options', 'DENY');
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	h.set('Cross-Origin-Opener-Policy', 'same-origin');
	if (!dev) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	if (api) h.set('Cache-Control', 'no-store');
	return response;
};

function json403(message: string) {
	return new Response(JSON.stringify({ message }), {
		status: 403,
		headers: { 'content-type': 'application/json' }
	});
}

export const handleError: HandleServerError = ({ kind, error }) => {
	// Expected errors keep their message. Anything unexpected is logged server-side only,
	// so driver errors and stack traces never reach the browser.
	if (kind === 'app') return error;
	if (kind === 'framework') return { message: error.message };
	console.error('[paceline]', error);
	return { message: 'Something went wrong. Try again.' };
};
