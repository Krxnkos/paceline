import type {
	ActiveBlock,
	Block,
	ISODate,
	Meeting,
	Plan,
	Placement,
	Settings,
	Task
} from '../types.ts';
import { addDays, dayWorkMinutes, diffDays, hmToMin, iso, nowMin, patternFor } from './dates.ts';

export const HORIZON_DAYS = 120;
const MIN_CHUNK = 15;
const AFTERNOON = 12 * 60;

type Interval = [number, number];

interface DayState {
	free: Interval[];
	budget: number;
}

/**
 * Minutes still to do on an open task. Unestimated work counts as 30 minutes;
 * an overrun task still open keeps a 15-minute block so it never drops off the plan.
 */
export function remainingMin(t: Task): number {
	if (t.status === 'done') return 0;
	const est = t.estimateMin > 0 ? t.estimateMin : 30;
	return Math.max(MIN_CHUNK, est - Math.max(t.loggedMin, t.creditMin ?? 0));
}

/** Higher runs first. Shared by the planner, must-dos and the table's default sort. */
export function score(t: Task, today: ISODate): number {
	let s = 0;
	if (t.start === 'asap') s += 1000;
	if (t.status === 'doing') s += 200;
	if (t.status === 'review') s += 120;
	s += (6 - t.priority) * 40;
	if (t.due) {
		const days = diffDays(t.due, today);
		s += Math.max(0, 140 - Math.max(days, -10) * 7);
	}
	s += Math.min(20, Math.max(0, diffDays(today, t.createdAt)));
	return s;
}

/** Days that belong to personal tasks; work is never scheduled on them. */
export function isPersonalDay(settings: Settings, date: ISODate): boolean {
	const k = patternFor(settings, date).kind;
	return k === 'personal' || k === 'off';
}

/** A task the planner may place: open, triaged, not a quick win, not manual. */
export function isSchedulable(t: Task): boolean {
	return t.status !== 'done' && !t.inbox && !t.quick && t.start !== 'manual' && remainingMin(t) > 0;
}

function subtract(free: Interval[], s: number, e: number): Interval[] {
	const out: Interval[] = [];
	for (const [a, b] of free) {
		if (e <= a || s >= b) out.push([a, b]);
		else {
			if (s > a) out.push([a, s]);
			if (e < b) out.push([e, b]);
		}
	}
	return out;
}

const total = (iv: Interval[]) => iv.reduce((n, [a, b]) => n + (b - a), 0);

/** Free working intervals for a date, after lunch and meetings. */
export function freeIntervals(settings: Settings, meetings: Meeting[], date: ISODate): Interval[] {
	const p = patternFor(settings, date);
	if (p.kind !== 'work') return [];
	let free: Interval[] = [[hmToMin(p.start), hmToMin(p.end)]];
	if (p.lunch) free = subtract(free, hmToMin(p.lunch[0]), hmToMin(p.lunch[1]));
	for (const m of meetings)
		if (m.date === date) free = subtract(free, hmToMin(m.start), hmToMin(m.end));
	return free;
}

/** Non-working days are open to personal tasks during these hours. */
const OFF_DAY_HOURS: Interval = [9 * 60, 18 * 60];

/** Free time for personal tasks: Personal and non-working days only. */
export function personalIntervals(
	settings: Settings,
	meetings: Meeting[],
	date: ISODate
): Interval[] {
	const p = patternFor(settings, date);
	if (p.kind !== 'personal' && p.kind !== 'off') return [];
	let free: Interval[] = [
		p.kind === 'personal' ? [hmToMin(p.start), hmToMin(p.end)] : OFF_DAY_HOURS
	];
	for (const m of meetings)
		if (m.date === date) free = subtract(free, hmToMin(m.start), hmToMin(m.end));
	return free;
}

/** Plannable minutes for a day: free time less the buffer. */
export function dayCapacity(settings: Settings, meetings: Meeting[], date: ISODate): number {
	return Math.round(
		total(freeIntervals(settings, meetings, date)) * (1 - settings.bufferPct / 100)
	);
}

/** Working minutes before buffer, for headers like "07:45–16:45 · 6.4 h plannable". */
export function dayWorking(settings: Settings, date: ISODate): number {
	return dayWorkMinutes(patternFor(settings, date));
}

/**
 * The auto-scheduler. Places every schedulable task into free time from now on,
 * highest score first, after its dependencies, never before its start date,
 * keeping the buffer free. Admin and Comms prefer afternoons.
 */
export function buildPlan(
	tasks: Task[],
	meetings: Meeting[],
	settings: Settings,
	now: Date,
	active: ActiveBlock | null = null
): Plan {
	const today = iso(now);
	const live = active && active.date === today && active.end > nowMin(now) ? active : null;
	const taken = tasks.flatMap((t) => t.history ?? []);
	if (live) taken.push(live);
	// Anchor today's plan to the current quarter-hour, so the block in progress
	// stays put (and shows as NOW) instead of sliding forward every minute.
	const nm = Math.floor(nowMin(now) / 15) * 15;
	const days = new Map<ISODate, DayState>();

	const day = (date: ISODate, personal: boolean): DayState => {
		let d = days.get(date);
		if (d) return d;
		// A day is either work or personal, never both, so one state per date is enough.
		const full = (personal ? personalIntervals : freeIntervals)(settings, meetings, date);
		const fullFree = total(full);
		let free = full;
		if (date === today) free = subtract(full, 0, nm);
		for (const h of taken) if (h.date === date) free = subtract(free, h.start, h.end);
		const remain = total(free);
		const budget = fullFree ? Math.round(remain * (1 - settings.bufferPct / 100)) : 0;
		d = { free, budget };
		days.set(date, d);
		return d;
	};

	const byId = new Map(tasks.map((t) => [t.id, t]));
	const open = tasks.filter(isSchedulable).sort((a, b) => score(b, today) - score(a, today));
	const openIds = new Set(open.map((t) => t.id));
	const placed: Record<string, Placement | null> = {};
	const beyond: string[] = [];
	const blocks: Block[] = [];

	// Blocked: waits on something that is neither done nor plannable.
	const blocked = (t: Task) =>
		t.deps.some((id) => {
			const d = byId.get(id);
			return d && d.status !== 'done' && !openIds.has(id);
		});

	const queue = [...open];
	const done = new Set<string>();
	let guard = queue.length * queue.length + 10;
	while (queue.length && guard-- > 0) {
		const idx = queue.findIndex((t) => t.deps.every((id) => !openIds.has(id) || done.has(id)));
		// Dependency cycle: place the best remaining task anyway.
		const t = queue.splice(idx >= 0 ? idx : 0, 1)[0];
		done.add(t.id);

		if (blocked(t)) {
			placed[t.id] = null;
			continue;
		}

		let earliestDate = today;
		let earliestMin = 0;
		if (t.start === 'date' && t.startDate && t.startDate > today) earliestDate = t.startDate;
		for (const id of t.deps) {
			const p = placed[id];
			if (!p) continue;
			if (p.endDate > earliestDate) {
				earliestDate = p.endDate;
				earliestMin = p.endMin;
			} else if (p.endDate === earliestDate) earliestMin = Math.max(earliestMin, p.endMin);
		}

		let r = remainingMin(t);
		const mine: Block[] = [];
		if (live?.taskId === t.id) {
			mine.push({ taskId: t.id, date: live.date, start: live.start, end: live.end });
			r = Math.max(0, r - (live.end - live.start));
		}
		const afternoonFirst = t.category === 'Admin' || t.category === 'Comms';
		for (let i = Math.max(0, diffDays(earliestDate, today)); i < HORIZON_DAYS && r > 0; i++) {
			const date = addDays(today, i);
			const personal = t.scope === 'personal';
			if (personal !== isPersonalDay(settings, date)) continue;
			const d = day(date, personal);
			if (d.budget <= 0) continue;
			const floor = date === earliestDate ? earliestMin : 0;
			const order = [...d.free]
				.map((iv): Interval => [Math.max(iv[0], floor), iv[1]])
				.filter(([a, b]) => b > a)
				.sort((x, y) =>
					afternoonFirst
						? Number(y[0] >= AFTERNOON) - Number(x[0] >= AFTERNOON) || x[0] - y[0]
						: x[0] - y[0]
				);
			for (const [a, b] of order) {
				if (r <= 0 || d.budget <= 0) break;
				const chunk = Math.min(r, b - a, d.budget);
				if (chunk < MIN_CHUNK && chunk < r) continue;
				const blk: Block = { taskId: t.id, date, start: a, end: a + chunk };
				mine.push(blk);
				d.free = subtract(d.free, a, a + chunk);
				d.budget -= chunk;
				r -= chunk;
			}
		}

		if (r > 0 || !mine.length) {
			placed[t.id] = null;
			beyond.push(t.id);
			continue;
		}
		const last = mine[mine.length - 1];
		placed[t.id] = { startDate: mine[0].date, endDate: last.date, endMin: last.end, blocks: mine };
		blocks.push(...mine);
	}

	blocks.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
	const byDate: Record<ISODate, Block[]> = {};
	for (const b of blocks) (byDate[b.date] ??= []).push(b);
	return { blocks, byDate, placed, beyond };
}

/** Minutes booked on a date by the plan. */
export function bookedMin(plan: Plan, date: ISODate): number {
	return (plan.byDate[date] ?? []).reduce((n, b) => n + b.end - b.start, 0);
}
