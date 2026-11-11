import type { ActiveBlock, Category, ISODate, Meeting, Plan, Settings, Task } from '../types.ts';
import { hmToMin, patternFor } from '../domain/dates.ts';
import { reservedSlots } from '../domain/plan.ts';

export type AgendaKind = 'block' | 'meeting' | 'lunch' | 'reserved';
export type AgendaState = 'past' | 'now' | 'future';

export interface AgendaItem {
	key: string;
	kind: AgendaKind;
	start: number;
	end: number;
	title: string;
	task?: Task;
	meeting?: Meeting;
	pinned: boolean;
	state: AgendaState;
	/** Already happened: kept on the calendar, not part of the plan. */
	history?: boolean;
	done?: boolean;
	/** Ended unfinished and waiting on "Did you complete this?". */
	confirm?: boolean;
	/** Dragged to this time by hand. */
	fixed?: boolean;
	/** Confirmed by the person: a solid block that won't move. */
	confirmed?: boolean;
	/** A quick win fitted into spare time. */
	quick?: boolean;
	/** Reserved time: the category it's kept for. */
	category?: Category;
}

/** Everything on a day in time order: planned blocks, meetings and lunch. */
export function agendaFor(
	date: ISODate,
	plan: Plan,
	tasks: Task[],
	meetings: Meeting[],
	settings: Settings,
	nowMin: number,
	today: ISODate,
	awaiting: ActiveBlock | null = null
): AgendaItem[] {
	const state = (s: number, e: number): AgendaState => {
		if (date < today) return 'past';
		if (date > today) return 'future';
		return e <= nowMin ? 'past' : s <= nowMin ? 'now' : 'future';
	};
	const items: AgendaItem[] = [];
	for (const t of tasks) {
		for (const h of t.history ?? []) {
			if (h.date !== date) continue;
			items.push({
				key: `h-${t.id}-${h.start}`,
				kind: 'block',
				start: h.start,
				end: h.end,
				title: t.title,
				task: t,
				pinned: false,
				state: 'past',
				history: true,
				done: t.status === 'done',
				confirm: awaiting?.taskId === t.id && awaiting.date === date && awaiting.start === h.start
			});
		}
	}
	const seen = new Map<string, number>();
	for (const b of plan.byDate[date] ?? []) {
		const t = tasks.find((x) => x.id === b.taskId);
		if (!t) continue;
		const n = seen.get(t.id) ?? 0;
		seen.set(t.id, n + 1);
		items.push({
			// Stable per task and day, so a moved block animates to its new place.
			key: `b-${b.taskId}-${n}`,
			kind: 'block',
			start: b.start,
			end: b.end,
			title: t.title,
			task: t,
			pinned: t.start === 'date' || t.start === 'asap' || !!t.fixed || !!t.confirmed?.length,
			fixed: t.fixed?.date === date && t.fixed.start === b.start,
			confirmed: !!t.confirmed?.some(
				(c) => c.date === date && b.start >= c.start && b.end <= c.end
			),
			quick: !!t.quick,
			state: state(b.start, b.end)
		});
	}
	for (const m of meetings.filter((m) => m.date === date)) {
		const s = hmToMin(m.start);
		const e = hmToMin(m.end);
		items.push({
			key: `m-${m.id}`,
			kind: 'meeting',
			start: s,
			end: e,
			title: m.title,
			meeting: m,
			pinned: true,
			state: state(s, e)
		});
	}
	for (const r of reservedSlots(settings, date))
		items.push({
			key: `r-${r.id}`,
			kind: 'reserved',
			start: r.start,
			end: r.end,
			title: r.label,
			category: r.category,
			pinned: true,
			state: state(r.start, r.end)
		});
	const p = patternFor(settings, date);
	if (p.kind === 'work' && p.lunch) {
		const s = hmToMin(p.lunch[0]);
		const e = hmToMin(p.lunch[1]);
		items.push({
			key: 'lunch',
			kind: 'lunch',
			start: s,
			end: e,
			title: 'Lunch',
			pinned: true,
			state: state(s, e)
		});
	}
	const rank: Record<AgendaKind, number> = { meeting: 0, reserved: 1, lunch: 2, block: 3 };
	return items.sort((a, b) => a.start - b.start || rank[a.kind] - rank[b.kind]);
}
