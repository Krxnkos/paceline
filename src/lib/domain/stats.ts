import type { Category, Goal, ISODate, Meeting, Plan, Project, Settings, Task } from '../types.ts';
import { addDays, diffDays, hmToMin, patternFor, weekStart } from './dates.ts';
import { bookedMin, dayCapacity, remainingMin } from './plan.ts';

export type Health = 'On track' | 'At risk' | 'Off track' | 'Complete' | 'Not started';

export interface ProjectStats {
	pct: number;
	total: number;
	open: number;
	remainingMin: number;
	finish: ISODate | null;
	health: Health;
}

export function projectStats(p: Project, tasks: Task[], plan: Plan): ProjectStats {
	const ts = tasks.filter((t) => t.projectId === p.id);
	const est = (t: Task) => Math.max(t.estimateMin, 1);
	const all = ts.reduce((n, t) => n + est(t), 0);
	const done = ts.filter((t) => t.status === 'done').reduce((n, t) => n + est(t), 0);
	const open = ts.filter((t) => t.status !== 'done');
	const remaining = open.reduce((n, t) => n + remainingMin(t), 0);
	const ends = open
		.map((t) => plan.placed[t.id]?.endDate)
		.filter((d): d is string => !!d)
		.sort();
	const finish = ends.at(-1) ?? null;
	const beyond = open.some((t) => plan.beyond.includes(t.id));
	let health: Health = 'On track';
	if (ts.length && !open.length) health = 'Complete';
	else if (!ts.some((t) => t.status === 'done' || t.loggedMin > 0)) health = 'Not started';
	if (health !== 'Complete' && p.due && (beyond || (finish && diffDays(finish, p.due) > 3)))
		health = 'Off track';
	else if (health !== 'Complete' && p.due && finish && finish > p.due) health = 'At risk';
	return {
		pct: all ? done / all : 0,
		total: ts.length,
		open: open.length,
		remainingMin: remaining,
		finish,
		health
	};
}

export type Pace = 'Ahead' | 'On pace' | 'Slightly behind' | 'Behind' | 'Achieved' | 'Missed';

export interface GoalProgress {
	current: number;
	pct: number;
	pace: Pace;
	daysLeft: number;
}

export function loggedHours(
	tasks: Task[],
	from: ISODate,
	to: ISODate,
	category?: Category
): number {
	let m = 0;
	for (const t of tasks) {
		if (category && t.category !== category) continue;
		for (const l of t.log) if (l.date >= from && l.date <= to) m += l.minutes;
	}
	return m / 60;
}

export function goalProgress(
	g: Goal,
	tasks: Task[],
	projects: Project[],
	plan: Plan,
	today: ISODate
): GoalProgress {
	let current = g.current;
	if (g.source === 'logged')
		current = Math.round(loggedHours(tasks, g.start, g.due, g.category) * 10) / 10;
	if (g.source === 'project' && g.projectId) {
		const p = projects.find((x) => x.id === g.projectId);
		current = p ? Math.round(projectStats(p, tasks, plan).pct * g.target) : 0;
	}
	const pct = g.target ? Math.min(1, current / g.target) : 0;
	const span = Math.max(1, diffDays(g.due, g.start));
	const elapsed = Math.min(1, Math.max(0, diffDays(today, g.start) / span));
	const daysLeft = diffDays(g.due, today);
	let pace: Pace;
	if (current >= g.target) pace = 'Achieved';
	else if (daysLeft < 0) pace = 'Missed';
	else {
		const ratio = elapsed ? pct / elapsed : 1;
		pace =
			ratio >= 1.1
				? 'Ahead'
				: ratio >= 0.95
					? 'On pace'
					: ratio >= 0.8
						? 'Slightly behind'
						: 'Behind';
	}
	return { current, pct, pace, daysLeft };
}

export interface WeekLoad {
	start: ISODate;
	capacityMin: number;
	bookedMin: number;
	meetingMin: number;
}

/** Free capacity against forecast work, per week, for the Insights chart. */
export function weeklyLoad(
	settings: Settings,
	meetings: Meeting[],
	plan: Plan,
	today: ISODate,
	weeks = 12
): WeekLoad[] {
	const out: WeekLoad[] = [];
	const w0 = weekStart(today);
	for (let w = 0; w < weeks; w++) {
		const start = addDays(w0, w * 7);
		let cap = 0;
		let booked = 0;
		let meet = 0;
		for (let i = 0; i < 7; i++) {
			const d = addDays(start, i);
			cap += dayCapacity(settings, meetings, d);
			booked += bookedMin(plan, d);
			if (patternFor(settings, d).kind === 'work')
				for (const m of meetings) if (m.date === d) meet += hmToMin(m.end) - hmToMin(m.start);
		}
		out.push({ start, capacityMin: cap, bookedMin: booked, meetingMin: meet });
	}
	return out;
}

/** Off-the-job hours: University days since the start date plus logged Study time. */
export function otjHours(
	settings: Settings,
	tasks: Task[],
	today: ISODate
): { uni: number; logged: number; total: number } {
	let uni = 0;
	const days = Math.min(1500, Math.max(0, diffDays(today, settings.otjStart)));
	for (let i = 0; i <= days; i++) {
		const d = addDays(settings.otjStart, i);
		const p = patternFor(settings, d);
		if (p.kind === 'uni') uni += p.otjHours;
	}
	const logged = loggedHours(tasks, settings.otjStart, today, 'Study');
	return { uni, logged, total: uni + logged };
}

/** Actual ÷ estimate over finished tasks with logged time. */
export function estimateFactor(tasks: Task[]): number | null {
	const done = tasks.filter((t) => t.status === 'done' && t.loggedMin > 0 && t.estimateMin > 0);
	if (!done.length) return null;
	return done.reduce((n, t) => n + t.loggedMin, 0) / done.reduce((n, t) => n + t.estimateMin, 0);
}

/** Share of dated tasks finished on or before their due date in the last 30 days. */
export function onTimeRate(tasks: Task[], today: ISODate): { rate: number | null; count: number } {
	const from = addDays(today, -30);
	const ts = tasks.filter((t) => t.status === 'done' && t.due && t.doneAt && t.doneAt >= from);
	if (!ts.length) return { rate: null, count: 0 };
	return { rate: ts.filter((t) => t.doneAt! <= t.due!).length / ts.length, count: ts.length };
}

export function categoryHours(
	tasks: Task[],
	from: ISODate,
	to: ISODate
): { label: Category; hours: number }[] {
	const cats: Category[] = ['Deep Work', 'Study', 'Review', 'Admin', 'Comms'];
	return cats
		.map((c) => ({ label: c, hours: loggedHours(tasks, from, to, c) }))
		.sort((a, b) => b.hours - a.hours);
}
