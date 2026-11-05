/**
 * Problems that stop the app talking to the server, shown as one notice:
 * - 'challenge': Cloudflare answered with a "verify you're human" page instead of our API.
 *   Background requests can't pass it; a page reload can.
 * - 'signedOut': the session ended while the tab was open.
 * Unsent edits stay in this browser's cache either way and sync once it's sorted.
 */
export type Issue = 'challenge' | 'signedOut' | null;

class Connection {
	issue = $state<Issue>(null);

	report(issue: Exclude<Issue, null>) {
		// Signed out wins: reloading won't help until they sign in.
		if (this.issue !== 'signedOut') this.issue = issue;
	}

	clear(issue: Exclude<Issue, null>) {
		if (this.issue === issue) this.issue = null;
	}
}

export const connection = new Connection();

export const CHALLENGE_MESSAGE =
	'Cloudflare needs to check this browser again. Reload the page to carry on.';

/** Where to go after signing in: only paths on this site, never another origin. */
export function safeNext(
	url: { searchParams: { get(k: string): string | null } },
	fallback = '/today'
): string {
	const n = url.searchParams.get('next') ?? '';
	return /^\/(?![/\\])/.test(n) && !/^\/(login|signup|reset)\b/.test(n) ? n : fallback;
}
