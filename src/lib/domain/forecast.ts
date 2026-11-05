import type { Alert, Badge, ISODate, Plan, Project, Settings, Task } from '../types.ts';
import { addDays, diffDays, dow, fmtShort } from './dates.ts';
import { score, splitDep } from './plan.ts';

export function code(n: number, prefix = 'T'): string {
	return `${prefix}-${String(n).padStart(prefix === 'T' ? 3 : 2, '0')}`;
}

/** Deadline pressure, independent of the plan. */
export function urgency(t: Task, today: ISODate): Badge {
	if (t.status === 'done') return { key: 'done', label: 'Done', tone: 'mute' };
	if (!t.due) return { key: 'none', label: 'No date', tone: 'mute' };
	const n = diffDays(t.due, today);
	if (n < 0) return { key: 'overdue', label: 'Overdue', tone: 'late' };
	if (n === 0) return { key: 'today', label: 'Due today', tone: 'warn' };
	if (n <= 2) return { key: 'soon', label: 'Due soon', tone: 'warn' };
	const d = dow(today);
	const endOfWeek = addDays(today, d === 0 ? 0 : 7 - d);
	if (t.due <= endOfWeek) return { key: 'week', label: 'This week', tone: 'info' };
	if (n <= 21) return { key: 'later', label: 'Later', tone: 'plain' };
	return { key: 'future', label: 'Future', tone: 'plain' };
}

/** Unfinished dependencies. */
export interface Blocker {
	id: string;
	taskId: string;
	/** "T-014", or "T-014 › Sub-task title" for a sub-task. */
	ref: string;
}

/** What a task still waits on: unfinished tasks, or unticked sub-tasks of other tasks. */
export function blockers(t: Task, tasks: Task[]): Blocker[] {
	const out: Blocker[] = [];
	for (const id of t.deps) {
		const [tid, sid] = splitDep(id);
		const d = tasks.find((x) => x.id === tid);
		if (!d || d.status === 'done') continue;
		if (!sid) out.push({ id, taskId: tid, ref: code(d.code) });
		else {
			const s = d.subtasks.find((x) => x.id === sid);
			if (s && !s.done) out.push({ id, taskId: tid, ref: `${code(d.code)} › ${s.title}` });
		}
	}
	return out;
}

/** When the plan says it will finish, against its due date. */
export function forecast(t: Task, plan: Plan, tasks: Task[] = []): Badge | null {
	if (t.status === 'done') return null;
	if (t.inbox) return { key: 'inbox', label: 'In inbox', tone: 'mute' };
	if (t.quick) return { key: 'quick', label: 'Quick win', tone: 'mute' };
	if (t.start === 'manual') return { key: 'manual', label: 'Manual', tone: 'mute' };
	const p = plan.placed[t.id];
	if (p === undefined) return null;
	if (p === null) {
		if (plan.beyond.includes(t.id)) return { key: 'beyond', label: 'Beyond', tone: 'late' };
		if (blockers(t, tasks).length) return { key: 'blocked', label: 'Blocked', tone: 'late' };
		return null;
	}
	if (!t.due) return { key: 'ends', label: `Ends ${fmtShort(p.endDate)}`, tone: 'plain' };
	const late = diffDays(p.endDate, t.due);
	if (late > 0) return { key: 'late', label: `Late +${late}d`, tone: 'late' };
	if (late === 0) return { key: 'tight', label: 'Tight', tone: 'warn' };
	return { key: 'ontime', label: 'On time', tone: 'plain' };
}

/**
 * Must-dos: top five by (planned today or due by today), then score.
 * Rows 4–5 stay locked until 1–3 are done.
 */
export function mustDos(tasks: Task[], plan: Plan, today: ISODate): Task[] {
	const todayIds = new Set((plan.byDate[today] ?? []).map((b) => b.taskId));
	const doneToday = tasks.filter((t) => t.status === 'done' && t.doneAt === today && !t.quick);
	const open = tasks
		.filter((t) => t.status !== 'done' && !t.inbox && !t.quick)
		.sort((a, b) => {
			const ka = Number(todayIds.has(a.id) || (!!a.due && a.due <= today));
			const kb = Number(todayIds.has(b.id) || (!!b.due && b.due <= today));
			return kb - ka || score(b, today) - score(a, today);
		});
	return [...doneToday, ...open].slice(0, 5);
}

/** Computed heads-up list, never stored. Order: overdue, late, no room, blocked, WIP, inbox. */
export function alerts(
	tasks: Task[],
	projects: Project[],
	plan: Plan,
	settings: Settings,
	today: ISODate
): Alert[] {
	const out: Alert[] = [];
	const open = tasks.filter((t) => t.status !== 'done');
	for (const t of open.filter((t) => t.due && t.due < today && !t.inbox))
		out.push({
			tone: 'late',
			label: 'Overdue',
			text: t.title,
			sub: `Was due ${fmtShort(t.due!)}`,
			taskId: t.id
		});
	for (const t of open) {
		const f = forecast(t, plan, tasks);
		if (f?.key === 'late' && !(t.due && t.due < today))
			out.push({
				tone: 'late',
				label: f.label,
				text: `Forecast: “${t.title}” finishes ${diffDays(plan.placed[t.id]!.endDate, t.due!)} day${diffDays(plan.placed[t.id]!.endDate, t.due!) === 1 ? '' : 's'} late`,
				sub: `Finishes ${fmtShort(plan.placed[t.id]!.endDate)}, due ${fmtShort(t.due!)}`,
				taskId: t.id
			});
	}
	for (const id of plan.beyond) {
		const t = tasks.find((x) => x.id === id);
		if (t)
			out.push({
				tone: 'late',
				label: 'No room',
				text: t.title,
				sub: 'No free time in the next 120 days',
				taskId: id
			});
	}
	for (const t of open.filter(
		(t) => (t.status === 'doing' || t.status === 'next') && blockers(t, tasks).length
	)) {
		out.push({
			tone: 'warn',
			label: 'Blocked',
			text: t.title,
			sub: `Waits on ${blockers(t, tasks)
				.map((b) => b.ref)
				.join(', ')}`,
			taskId: t.id
		});
	}
	const wip = open.filter((t) => t.status === 'doing').length;
	if (wip > settings.wipLimit)
		out.push({
			tone: 'warn',
			label: `WIP ${wip}/${settings.wipLimit}`,
			text: 'Too much in progress',
			sub: 'Finish something before starting more',
			view: '/board'
		});
	for (const p of projects) {
		if (!p.due) continue;
		const ts = open.filter((t) => t.projectId === p.id);
		const ends = ts.map((t) => plan.placed[t.id]?.endDate).filter(Boolean) as string[];
		const finish = ends.sort().at(-1);
		if (finish && finish > p.due)
			out.push({
				tone: 'warn',
				label: 'At risk',
				text: `Project “${p.name}” at risk`,
				sub: `Finishes ${fmtShort(finish)}, target ${fmtShort(p.due)}`,
				view: `/projects/${p.id}`
			});
	}
	const inbox = open.filter((t) => t.inbox).length;
	if (inbox)
		out.push({
			tone: 'info',
			label: `Inbox ${inbox}`,
			text: `${inbox} item${inbox === 1 ? '' : 's'} to triage`,
			sub: 'Give each one a project, date or estimate',
			view: '/inbox'
		});
	return out;
}
