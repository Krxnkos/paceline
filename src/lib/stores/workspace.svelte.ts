import type { Goal, Meeting, Project, Settings, Status, Task, Workspace } from '../types.ts';
import { addDays, addMonths, fmtShort } from '../domain/dates.ts';
import { parseCapture, type Parsed } from '../domain/parse.ts';
import { buildPlan } from '../domain/plan.ts';
import { alerts, code } from '../domain/forecast.ts';
import { blankWorkspace, exampleWorkspace, newTask, uid } from '../domain/seed.ts';
import { clock } from './clock.svelte.ts';
import { toast } from './toast.svelte.ts';

const KEY = (userId: string) => `pl-ws:${userId}`;
const UNDO_LIMIT = 30;

function nextDue(due: string, repeat: Task['repeat']): string {
	switch (repeat) {
		case 'daily':
			return addDays(due, 1);
		case 'weekly':
			return addDays(due, 7);
		case 'fortnightly':
			return addDays(due, 14);
		case 'monthly':
			return addMonths(due, 1);
		default:
			return due;
	}
}

class WorkspaceStore {
	userId = $state<string | null>(null);
	data = $state<Workspace | null>(null);
	saving = $state<'synced' | 'saving' | 'offline'>('synced');
	#undo: string[] = [];
	canUndo = $state(false);

	tasks = $derived(this.data?.tasks ?? []);
	projects = $derived(this.data?.projects ?? []);
	meetings = $derived(this.data?.meetings ?? []);
	goals = $derived(this.data?.goals ?? []);
	settings = $derived(this.data?.settings as Settings);
	plan = $derived(
		buildPlan(
			this.tasks,
			this.meetings,
			this.data?.settings ?? blankWorkspace(clock.today).settings,
			clock.now
		)
	);
	alerts = $derived(
		this.data ? alerts(this.tasks, this.projects, this.plan, this.data.settings, clock.today) : []
	);
	inboxCount = $derived(this.tasks.filter((t) => t.inbox && t.status !== 'done').length);

	load(userId: string) {
		if (this.userId === userId && this.data) return;
		this.userId = userId;
		this.#undo = [];
		this.canUndo = false;
		try {
			const raw = localStorage.getItem(KEY(userId));
			this.data = raw ? (JSON.parse(raw) as Workspace) : null;
		} catch {
			this.data = null;
		}
	}

	unload() {
		this.userId = null;
		this.data = null;
	}

	start(kind: 'example' | 'blank') {
		this.data = kind === 'example' ? exampleWorkspace(clock.today) : blankWorkspace(clock.today);
		this.#persist();
	}

	#persist() {
		if (!this.userId || !this.data) return;
		this.saving = 'saving';
		try {
			localStorage.setItem(KEY(this.userId), JSON.stringify($state.snapshot(this.data)));
			this.saving = 'synced';
		} catch {
			this.saving = 'offline';
		}
	}

	#checkpoint() {
		if (!this.data) return;
		this.#undo.push(JSON.stringify($state.snapshot(this.data)));
		if (this.#undo.length > UNDO_LIMIT) this.#undo.shift();
		this.canUndo = true;
	}

	/** Run a change with an undo checkpoint and save. */
	#change<T>(fn: (ws: Workspace) => T): T {
		this.#checkpoint();
		const out = fn(this.data!);
		this.#persist();
		return out;
	}

	undo() {
		const last = this.#undo.pop();
		this.canUndo = this.#undo.length > 0;
		if (!last) {
			toast('Nothing to undo');
			return;
		}
		this.data = JSON.parse(last) as Workspace;
		this.#persist();
		toast('Undone');
	}

	task(id: string | null | undefined) {
		return id ? this.tasks.find((t) => t.id === id) : undefined;
	}

	taskByCode(n: number) {
		return this.tasks.find((t) => t.code === n);
	}

	project(id: string | null | undefined) {
		return id ? this.projects.find((p) => p.id === id) : undefined;
	}

	// ── Capture ───────────────────────────────────────────────

	parse(text: string): Parsed {
		return parseCapture(text, { today: clock.today, projects: this.projects });
	}

	/** Smart capture: creates a task or meeting from one line. */
	capture(
		text: string,
		opts: { inbox?: boolean; defaults?: Partial<Task> } = {}
	): Task | Meeting | null {
		const p = this.parse(text);
		if (!p.title) return null;
		if (p.kind === 'meeting') {
			const m = this.addMeeting({
				title: p.title,
				date: p.due ?? clock.today,
				start: p.mStart ?? '10:00',
				end: p.mEnd ?? '10:30'
			});
			toast(`Meeting added · ${fmtShort(m.date)} ${m.start}`);
			return m;
		}
		return this.#change((ws) => {
			let projectId = p.projectId ?? opts.defaults?.projectId ?? null;
			if (p.newProject) {
				const proj: Project = {
					id: uid(),
					code: ws.nextProjectCode++,
					name: p.newProject,
					description: '',
					due: null
				};
				ws.projects.push(proj);
				projectId = proj.id;
			}
			const hasShape = !!(projectId || p.due || p.est);
			const t = newTask(ws.nextCode++, clock.today, {
				...opts.defaults,
				title: p.title,
				projectId,
				priority: p.imp ?? opts.defaults?.priority ?? 3,
				category: p.cat ?? opts.defaults?.category ?? (p.quick ? 'Admin' : 'Deep Work'),
				due: p.due ?? opts.defaults?.due ?? null,
				estimateMin: p.est ?? (p.quick ? 10 : 30),
				start: p.start ?? 'auto',
				startDate: p.startDate ?? null,
				repeat: p.repeat ?? '',
				quick: !!p.quick,
				inbox: opts.inbox ?? (!p.quick && !hasShape && !opts.defaults),
				status: 'next'
			});
			ws.tasks.push(t);
			const where = t.inbox ? 'Captured to Inbox' : t.quick ? 'Quick win added' : 'Added to plan';
			toast(`${where} · ${code(t.code)}`, { action: 'Open', onAction: () => openTask(t.id) });
			return t;
		});
	}

	// ── Tasks ─────────────────────────────────────────────────

	addTask(patch: Partial<Task>): Task {
		return this.#change((ws) => {
			const t = newTask(ws.nextCode++, clock.today, patch);
			ws.tasks.push(t);
			return t;
		});
	}

	updateTask(id: string, patch: Partial<Task>) {
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id);
			if (t) Object.assign(t, patch);
		});
	}

	setStatus(id: string, status: Status) {
		if (status === 'done') return this.complete(id);
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id);
			if (!t) return;
			t.status = status;
			t.doneAt = null;
			t.inbox = false;
		});
	}

	complete(id: string) {
		const t0 = this.task(id);
		if (!t0) return;
		if (t0.status === 'done') {
			this.#change((ws) => {
				const t = ws.tasks.find((x) => x.id === id)!;
				t.status = 'next';
				t.doneAt = null;
			});
			toast(`Reopened ${code(t0.code)}`, { action: 'Undo', onAction: () => this.undo() });
			return;
		}
		let msg = `Completed ${code(t0.code)}`;
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id)!;
			t.status = 'done';
			t.doneAt = clock.today;
			t.inbox = false;
			if (t.repeat) {
				const due = nextDue(t.due ?? clock.today, t.repeat);
				const next = newTask(ws.nextCode++, clock.today, {
					...structuredClone($state.snapshot(t)),
					id: uid(),
					code: ws.nextCode - 1,
					status: 'next',
					doneAt: null,
					loggedMin: 0,
					log: [],
					due,
					subtasks: t.subtasks.map((s) => ({ ...s, id: uid(), done: false }))
				});
				ws.tasks.push(next);
				msg += ` · next due ${fmtShort(due).slice(4)}`;
			}
		});
		toast(msg, { action: 'Undo', onAction: () => this.undo() });
	}

	deleteTask(id: string) {
		const t = this.task(id);
		if (!t) return;
		this.#change((ws) => {
			ws.tasks = ws.tasks.filter((x) => x.id !== id);
			for (const x of ws.tasks) x.deps = x.deps.filter((d) => d !== id);
		});
		toast(`Deleted ${code(t.code)}`, { action: 'Undo', onAction: () => this.undo() });
	}

	deleteMany(ids: string[]) {
		const set = new Set(ids);
		this.#change((ws) => {
			ws.tasks = ws.tasks.filter((x) => !set.has(x.id));
			for (const x of ws.tasks) x.deps = x.deps.filter((d) => !set.has(d));
		});
	}

	updateMany(ids: string[], patch: Partial<Task>) {
		const set = new Set(ids);
		this.#change((ws) => {
			for (const t of ws.tasks)
				if (set.has(t.id))
					Object.assign(t, patch, patch.status === 'done' ? { doneAt: clock.today } : {});
		});
	}

	logTime(id: string, minutes: number) {
		if (minutes <= 0) return;
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id);
			if (!t) return;
			t.loggedMin += minutes;
			const today = t.log.find((l) => l.date === clock.today);
			if (today) today.minutes += minutes;
			else t.log.push({ date: clock.today, minutes });
			if (t.status === 'next' || t.status === 'backlog') t.status = 'doing';
		});
	}

	addSubtask(id: string, title: string) {
		this.#change((ws) =>
			ws.tasks.find((x) => x.id === id)?.subtasks.push({ id: uid(), title, done: false })
		);
	}

	toggleSubtask(id: string, sid: string) {
		this.#change((ws) => {
			const s = ws.tasks.find((x) => x.id === id)?.subtasks.find((s) => s.id === sid);
			if (s) s.done = !s.done;
		});
	}

	removeSubtask(id: string, sid: string) {
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id);
			if (t) t.subtasks = t.subtasks.filter((s) => s.id !== sid);
		});
	}

	clearCompleted() {
		const n = this.tasks.filter((t) => t.status === 'done').length;
		this.#change((ws) => {
			ws.tasks = ws.tasks.filter((t) => t.status !== 'done');
		});
		return n;
	}

	// ── Meetings, projects, goals, settings ───────────────────

	addMeeting(m: Omit<Meeting, 'id'>): Meeting {
		return this.#change((ws) => {
			const meeting = { ...m, id: uid() };
			ws.meetings.push(meeting);
			return meeting;
		});
	}

	updateMeeting(id: string, patch: Partial<Meeting>) {
		this.#change((ws) => Object.assign(ws.meetings.find((m) => m.id === id) ?? {}, patch));
	}

	deleteMeeting(id: string) {
		this.#change((ws) => {
			ws.meetings = ws.meetings.filter((m) => m.id !== id);
		});
		toast('Meeting deleted', { action: 'Undo', onAction: () => this.undo() });
	}

	addProject(p: Omit<Project, 'id' | 'code'>): Project {
		return this.#change((ws) => {
			const proj = { ...p, id: uid(), code: ws.nextProjectCode++ };
			ws.projects.push(proj);
			return proj;
		});
	}

	updateProject(id: string, patch: Partial<Project>) {
		this.#change((ws) => Object.assign(ws.projects.find((p) => p.id === id) ?? {}, patch));
	}

	deleteProject(id: string) {
		this.#change((ws) => {
			ws.projects = ws.projects.filter((p) => p.id !== id);
			for (const t of ws.tasks) if (t.projectId === id) t.projectId = null;
			for (const g of ws.goals) if (g.projectId === id) g.projectId = undefined;
		});
		toast('Project deleted · its tasks were kept', { action: 'Undo', onAction: () => this.undo() });
	}

	addGoal(g: Omit<Goal, 'id'>): Goal {
		return this.#change((ws) => {
			const goal = { ...g, id: uid() };
			ws.goals.push(goal);
			return goal;
		});
	}

	updateGoal(id: string, patch: Partial<Goal>) {
		this.#change((ws) => Object.assign(ws.goals.find((g) => g.id === id) ?? {}, patch));
	}

	deleteGoal(id: string) {
		this.#change((ws) => {
			ws.goals = ws.goals.filter((g) => g.id !== id);
		});
		toast('Goal deleted', { action: 'Undo', onAction: () => this.undo() });
	}

	updateSettings(patch: Partial<Settings>) {
		this.#change((ws) => Object.assign(ws.settings, patch));
	}

	// ── Data ──────────────────────────────────────────────────

	exportJSON(): string {
		return JSON.stringify($state.snapshot(this.data), null, 2);
	}

	importJSON(text: string) {
		const parsed = JSON.parse(text) as Workspace;
		if (!Array.isArray(parsed.tasks) || !parsed.settings) throw new Error('Not a Paceline export');
		this.#change(() => undefined);
		this.data = parsed;
		this.#persist();
	}
}

export const workspace = new WorkspaceStore();

// Drawer routing: ?task=T-014 opens the task drawer. Set by the app layout.
let opener: (id: string) => void = () => {};
export function setTaskOpener(fn: (id: string) => void) {
	opener = fn;
}
export function openTask(id: string) {
	opener(id);
}
