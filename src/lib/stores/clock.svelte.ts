import { iso, nowMin } from '../domain/dates.ts';

/**
 * Wall clock, ticking every 20 seconds. The plan re-runs when the minute changes.
 * In development, `?now=2026-10-28T10:19` time-travels the whole app (kept for the session).
 */
class Clock {
	#offset = 0;
	now = $state(new Date());
	today = $derived(iso(this.now));
	minute = $derived(nowMin(this.now));
	#timer: ReturnType<typeof setInterval> | null = null;

	#read() {
		return new Date(Date.now() + this.#offset);
	}

	get offset() {
		return this.#offset;
	}

	/** Developer tools: view the app at another moment (this tab only). Null is real time. */
	travel(to: Date | null) {
		this.#offset = to ? to.getTime() - Date.now() : 0;
		this.now = this.#read();
	}

	start() {
		if (this.#timer || typeof window === 'undefined') return;
		if (import.meta.env.DEV) {
			const param = new URLSearchParams(location.search).get('now');
			if (param) sessionStorage.setItem('pl-now', String(new Date(param).getTime() - Date.now()));
			if (param === 'real') sessionStorage.removeItem('pl-now');
			this.#offset = Number(sessionStorage.getItem('pl-now')) || 0;
		}
		this.now = this.#read();
		this.#timer = setInterval(() => {
			const n = this.#read();
			if (n.getMinutes() !== this.now.getMinutes() || n.getDate() !== this.now.getDate())
				this.now = n;
		}, 20_000);
	}
}

export const clock = new Clock();
