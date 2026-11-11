import { workspace } from './workspace.svelte.ts';
import { clock } from './clock.svelte.ts';
import { toast } from './toast.svelte.ts';
import type { FocusPreset, Settings } from '../types.ts';

/** Focus rhythms people actually use. Break lengths in minutes. */
export const FOCUS_PRESETS: Record<FocusPreset, { label: string; hint: string }> = {
	pomodoro: { label: 'Pomodoro', hint: '25 min focus, 5 min break, 15 min every fourth' },
	'52-17': { label: '52 / 17', hint: '52 min focus, 17 min break' },
	'90-20': { label: '90 / 20', hint: 'One 90 min deep-work cycle, 20 min break' },
	flowtime: { label: 'Flowtime', hint: 'Count up, stop when focus fades; break is a fifth of it' },
	fit: { label: 'Fit the block', hint: 'Runs for the rest of the current block' },
	custom: { label: 'Custom', hint: 'Your own focus and break lengths' }
};

/** The rhythm in use, working out older settings that predate presets. */
export function presetOf(s: Settings | undefined): FocusPreset {
	if (s?.focusPreset) return s.focusPreset;
	if (s?.focusMode === 'fit') return 'fit';
	return (s?.focusMin ?? 25) === 25 && (s?.breakMin ?? 5) === 5 ? 'pomodoro' : 'custom';
}

export interface FocusState {
	taskId: string | null;
	phase: 'focus' | 'break';
	total: number; // seconds in this block
	endsAt: number; // epoch ms, while running
	paused: boolean;
	remaining: number; // seconds, kept fresh while paused
	minimised: boolean;
	loggedSec: number; // focus seconds already logged in this block
	/** Flowtime: counts up instead of down. */
	up?: boolean;
	/** Focus blocks finished in a row, for the Pomodoro long break. */
	cycles?: number;
}

const KEY = 'pl-focus';

/** Pomodoro timer. Persisted so a reload resumes where it was. */
class Focus {
	state = $state<FocusState | null>(null);
	remaining = $state(0);
	#timer: ReturnType<typeof setInterval> | null = null;

	running = $derived(!!this.state && !this.state.paused);
	/** Seconds of focus so far in this block. */
	elapsed = $derived(this.state ? this.state.total - this.remaining : 0);
	counting = $derived(!!this.state?.up && this.state.phase === 'focus');
	clock = $derived(fmtClock(this.counting ? this.elapsed : this.remaining));
	progress = $derived(
		!this.state
			? 0
			: this.counting
				? Math.min(1, this.elapsed / (50 * 60))
				: 1 - this.remaining / this.state.total
	);

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

	/** Minutes for the next focus block under the chosen rhythm (0 means count up). */
	plannedMin(): number {
		const s = workspace.settings;
		const a = workspace.active;
		switch (presetOf(s)) {
			case 'pomodoro':
				return 25;
			case '52-17':
				return 52;
			case '90-20':
				return 90;
			case 'flowtime':
				return 0;
			case 'fit':
				return a ? Math.max(1, a.end - clock.minute) : (s?.focusMin ?? 25);
			default:
				return s?.focusMin ?? 25;
		}
	}

	/** Break after a focus block of `focusSec` seconds. */
	#breakMin(focusSec: number, cycles: number): number {
		const s = workspace.settings;
		switch (presetOf(s)) {
			case 'pomodoro':
				return cycles > 0 && cycles % 4 === 0 ? 15 : 5;
			case '52-17':
				return 17;
			case '90-20':
				return 20;
			case 'flowtime':
				return Math.min(30, Math.max(5, Math.round(focusSec / 60 / 5)));
			default:
				return s?.breakMin ?? 5;
		}
	}

	start(taskId: string | null, minutes = this.plannedMin()) {
		const up = minutes <= 0;
		// Flowtime counts up; it stops by itself after four hours.
		const total = up ? 4 * 3600 : Math.max(1, minutes) * 60;
		this.state = {
			taskId,
			phase: 'focus',
			total,
			endsAt: Date.now() + total * 1000,
			paused: false,
			remaining: total,
			minimised: false,
			loggedSec: 0,
			up,
			cycles: this.state?.cycles ?? 0
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

	/** Flowtime: focus is fading, so log it and take a break in proportion. */
	breakNow() {
		if (this.state?.phase === 'focus') this.#finish();
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
			const focusSec = s.total - this.remaining;
			const mins = Math.round(this.#unlogged() / 60);
			if (s.taskId && mins > 0) workspace.logTime(s.taskId, mins);
			const cycles = (s.cycles ?? 0) + 1;
			const brk = this.#breakMin(focusSec, cycles) * 60;
			this.state = {
				...s,
				phase: 'break',
				total: brk,
				endsAt: Date.now() + brk * 1000,
				paused: false,
				remaining: brk,
				loggedSec: 0,
				up: false,
				cycles
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
