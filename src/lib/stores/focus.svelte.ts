import { workspace } from './workspace.svelte.ts';
import { toast } from './toast.svelte.ts';

export interface FocusState {
	taskId: string | null;
	phase: 'focus' | 'break';
	total: number; // seconds in this block
	endsAt: number; // epoch ms, while running
	paused: boolean;
	remaining: number; // seconds, kept fresh while paused
	minimised: boolean;
	loggedSec: number; // focus seconds already logged in this block
}

const KEY = 'pl-focus';

/** Pomodoro timer. Persisted so a reload resumes where it was. */
class Focus {
	state = $state<FocusState | null>(null);
	remaining = $state(0);
	#timer: ReturnType<typeof setInterval> | null = null;

	running = $derived(!!this.state && !this.state.paused);
	clock = $derived(fmtClock(this.remaining));
	progress = $derived(this.state ? 1 - this.remaining / this.state.total : 0);

	init() {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				this.state = JSON.parse(raw) as FocusState;
				this.#sync();
				if (!this.state.paused) this.#loop();
			}
		} catch {
			this.state = null;
		}
	}

	#save() {
		try {
			if (this.state) localStorage.setItem(KEY, JSON.stringify(this.state));
			else localStorage.removeItem(KEY);
		} catch {
			/* storage blocked */
		}
	}

	#sync() {
		const s = this.state;
		if (!s) return;
		this.remaining = s.paused
			? s.remaining
			: Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
		if (!s.paused && this.remaining <= 0) this.#finish();
	}

	#loop() {
		this.#stopLoop();
		this.#timer = setInterval(() => this.#sync(), 250);
	}

	#stopLoop() {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
	}

	start(taskId: string | null, minutes = workspace.settings?.focusMin ?? 25) {
		const total = minutes * 60;
		this.state = {
			taskId,
			phase: 'focus',
			total,
			endsAt: Date.now() + total * 1000,
			paused: false,
			remaining: total,
			minimised: false,
			loggedSec: 0
		};
		this.remaining = total;
		this.#save();
		this.#loop();
	}

	pause() {
		const s = this.state;
		if (!s || s.paused) return;
		this.#sync();
		s.paused = true;
		s.remaining = this.remaining;
		this.#stopLoop();
		this.#save();
	}

	resume() {
		const s = this.state;
		if (!s || !s.paused) return;
		s.paused = false;
		s.endsAt = Date.now() + s.remaining * 1000;
		this.#save();
		this.#loop();
	}

	toggle() {
		if (this.state?.paused) this.resume();
		else this.pause();
	}

	addFive() {
		const s = this.state;
		if (!s) return;
		s.total += 300;
		if (s.paused) s.remaining += 300;
		else s.endsAt += 300_000;
		this.#sync();
		this.#save();
	}

	reset() {
		this.#stopLoop();
		this.state = null;
		this.remaining = 0;
		this.#save();
	}

	setMinimised(v: boolean) {
		if (!this.state) return;
		this.state.minimised = v;
		this.#save();
	}

	/** Elapsed focus seconds not yet logged. */
	#unlogged(): number {
		const s = this.state;
		if (!s || s.phase !== 'focus') return 0;
		return Math.max(0, s.total - this.remaining - s.loggedSec);
	}

	/** End the block now and log the minutes spent. */
	endAndLog() {
		const s = this.state;
		if (!s) return;
		const mins = Math.round(this.#unlogged() / 60);
		if (s.taskId && mins > 0) {
			workspace.logTime(s.taskId, mins);
			toast(`Logged ${mins} min`);
		}
		this.reset();
	}

	completeTask() {
		const s = this.state;
		if (!s?.taskId) return;
		const id = s.taskId;
		this.endAndLog();
		workspace.complete(id);
	}

	#finish() {
		const s = this.state;
		if (!s) return;
		if (s.phase === 'focus') {
			const mins = Math.round(this.#unlogged() / 60);
			if (s.taskId && mins > 0) workspace.logTime(s.taskId, mins);
			const brk = (workspace.settings?.breakMin ?? 5) * 60;
			this.state = {
				...s,
				phase: 'break',
				total: brk,
				endsAt: Date.now() + brk * 1000,
				paused: false,
				remaining: brk,
				loggedSec: 0
			};
			this.remaining = brk;
			toast(`Focus block done · ${mins} min logged · take a break`);
			notify('Focus block done', 'Time for a break.');
		} else {
			this.reset();
			toast('Break over · ready for the next block');
			notify('Break over', 'Ready for the next block.');
			return;
		}
		this.#save();
	}
}

function notify(title: string, body: string) {
	try {
		if ('Notification' in window && Notification.permission === 'granted')
			new Notification(title, { body });
	} catch {
		/* unsupported */
	}
}

export function fmtClock(sec: number): string {
	const s = Math.max(0, Math.round(sec));
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const focus = new Focus();
