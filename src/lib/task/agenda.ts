import type { ActiveBlock, ISODate, Meeting, Plan, Settings, Task } from '../types.ts';
import { hmToMin, patternFor } from '../domain/dates.ts';

export type AgendaKind = 'block' | 'meeting' | 'lunch';
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
	for (const b of plan.byDate[date] ?? []) {
		const t = tasks.find((x) => x.id === b.taskId);
		if (!t) continue;
		items.push({
			key: `b-${b.taskId}-${b.start}`,
			kind: 'block',
			start: b.start,
			end: b.end,
			title: t.title,
			task: t,
			pinned: t.start === 'date' || t.start === 'asap',
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
	return items.sort((a, b) => a.start - b.start || (a.kind === 'meeting' ? -1 : 1));
}
