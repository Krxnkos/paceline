import type {
	ActiveBlock,
	Block,
	Category,
	ISODate,
	Meeting,
	Plan,
	Placement,
	Settings,
	Task
} from '../types.ts';
import {
	addDays,
	dayWorkMinutes,
	diffDays,
	dow,
	hmToMin,
	iso,
	nowMin,
	patternFor
} from './dates.ts';

export const HORIZON_DAYS = 120;
const MIN_CHUNK = 15;
const AFTERNOON = 12 * 60;

type Interval = [number, number];

interface DayState {
	free: Interval[];
	budget: number;
	/** Reserved time by category: only that category's tasks may use it. */
	reserved: Map<Category, Interval[]>;
}

export interface ReservedSlot {
	id: string;
	label: string;
	category: Category;
	start: number;
	end: number;
}

/** Reserved time on a work day, clipped to working hours. */
export function reservedSlots(settings: Settings, date: ISODate): ReservedSlot[] {
	const p = patternFor(settings, date);
	if (p.kind !== 'work') return [];
	const dayStart = hmToMin(p.start);
	const dayEnd = hmToMin(p.end);
	const list = Array.isArray(settings.reserved) ? settings.reserved : [];
	return list
		.filter(
			(r) =>
				r &&
				Array.isArray(r.days) &&
				r.days.includes(dow(date)) &&
				typeof r.minutes === 'number' &&
				r.minutes > 0 &&
				(r.start === 'start' || (typeof r.start === 'string' && /^\d\d:\d\d$/.test(r.start)))
		)
		.map((r) => {
			const start = r.start === 'start' ? dayStart : hmToMin(r.start);
			return {
				id: r.id,
				label: r.label,
				category: r.category,
				start: Math.max(start, dayStart),
				end: Math.min(start + r.minutes, dayEnd)
			};
		})
		.filter((r) => r.end > r.start);
}

/** Splits a dependency id: "taskId", or "taskId:subtaskId" for a sub-task. */
export function splitDep(id: string): [string, string | null] {
	id = String(id);
	const i = id.indexOf(':');
	return i < 0 ? [id, null] : [id.slice(0, i), id.slice(i + 1)];
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
	for (const r of reservedSlots(settings, date)) free = subtract(free, r.start, r.end);
	return free;
}

/** Reserved minutes on a date, after lunch and meetings. */
function reservedIntervals(settings: Settings, meetings: Meeting[], date: ISODate) {
	const p = patternFor(settings, date);
	const out = new Map<Category, Interval[]>();
	for (const r of reservedSlots(settings, date)) {
		let iv: Interval[] = [[r.start, r.end]];
		if (p.kind === 'work' && p.lunch) iv = subtract(iv, hmToMin(p.lunch[0]), hmToMin(p.lunch[1]));
		for (const m of meetings)
			if (m.date === date) iv = subtract(iv, hmToMin(m.start), hmToMin(m.end));
		out.set(r.category, [...(out.get(r.category) ?? []), ...iv]);
	}
	return out;
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

/** Plannable minutes for a day: free time less the buffer, plus reserved time. */
export function dayCapacity(settings: Settings, meetings: Meeting[], date: ISODate): number {
	let reserved = 0;
	for (const iv of reservedIntervals(settings, meetings, date).values()) reserved += total(iv);
	return (
		Math.round(total(freeIntervals(settings, meetings, date)) * (1 - settings.bufferPct / 100)) +
		reserved
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
	const taken: { date: ISODate; start: number; end: number }[] = tasks.flatMap(
		(t) => t.history ?? []
	);
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
		const cut = (iv: Interval[]) => {
			let out = date === today ? subtract(iv, 0, nm) : iv;
			for (const h of taken) if (h.date === date) out = subtract(out, h.start, h.end);
			return out;
		};
		const free = cut(full);
		const reserved = new Map<Category, Interval[]>();
		if (!personal)
			for (const [c, iv] of reservedIntervals(settings, meetings, date)) reserved.set(c, cut(iv));
		const remain = total(free);
		const budget = fullFree ? Math.round(remain * (1 - settings.bufferPct / 100)) : 0;
		d = { free, budget, reserved };
		days.set(date, d);
		return d;
	};

	const byId = new Map(tasks.map((t) => [t.id, t]));
	const open = tasks.filter(isSchedulable).sort((a, b) => score(b, today) - score(a, today));
	const openIds = new Set(open.map((t) => t.id));
	const placed: Record<string, Placement | null> = {};
	const beyond: string[] = [];
	const blocks: Block[] = [];

	// Blocked: waits on a task that is neither done nor plannable, or on an unticked sub-task.
	const blocked = (t: Task) =>
		t.deps.some((id) => {
			const [tid, sid] = splitDep(id);
			const d = byId.get(tid);
			if (!d || d.status === 'done') return false;
			if (sid) return d.subtasks.some((x) => x.id === sid && !x.done);
			return !openIds.has(tid);
		});

	// Tasks dragged to a start time claim that slot before anything else is placed.
	const fixed = new Map<string, Block>();
	for (const t of open) {
		const f = t.fixed;
		if (
			!f ||
			typeof f.date !== 'string' ||
			typeof f.start !== 'number' ||
			!Number.isFinite(f.start) ||
			f.date < today ||
			live?.taskId === t.id ||
			blocked(t)
		)
			continue;
		const end = Math.min(f.start + remainingMin(t), 24 * 60);
		if (f.date === today && end <= nowMin(now)) continue;
		const b: Block = { taskId: t.id, date: f.date, start: f.start, end };
		fixed.set(t.id, b);
		taken.push(b);
	}

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
		const fx = fixed.get(t.id);
		if (fx) {
			mine.push(fx);
			r = 0;
		}
		const afternoonFirst = t.category === 'Admin' || t.category === 'Comms';
		for (let i = Math.max(0, diffDays(earliestDate, today)); i < HORIZON_DAYS && r > 0; i++) {
			const date = addDays(today, i);
			const personal = t.scope === 'personal';
			if (personal !== isPersonalDay(settings, date)) continue;
			const d = day(date, personal);
			const floor = date === earliestDate ? earliestMin : 0;
			const fit = (iv: Interval[]) =>
				iv
					.map((x): Interval => [Math.max(x[0], floor), x[1]])
					.filter(([a, b]) => b > a)
					.sort((x, y) =>
						afternoonFirst
							? Number(y[0] >= AFTERNOON) - Number(x[0] >= AFTERNOON) || x[0] - y[0]
							: x[0] - y[0]
					);
			// Time reserved for this category first (it sits outside the buffer), then open time.
			for (const [a, b] of fit(d.reserved.get(t.category) ?? [])) {
				if (r <= 0) break;
				const chunk = Math.min(r, b - a);
				if (chunk < 5 && chunk < r) continue;
				mine.push({ taskId: t.id, date, start: a, end: a + chunk });
				d.reserved.set(t.category, subtract(d.reserved.get(t.category)!, a, a + chunk));
				r -= chunk;
			}
			for (const [a, b] of fit(d.free)) {
				if (r <= 0 || d.budget <= 0) break;
				const chunk = Math.min(r, b - a, d.budget);
				if (chunk < MIN_CHUNK && chunk < r) continue;
				mine.push({ taskId: t.id, date, start: a, end: a + chunk });
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
		mine.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
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
