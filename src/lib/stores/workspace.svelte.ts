import type {
	BlockSpan,
	Goal,
	Meeting,
	Project,
	Settings,
	Status,
	Task,
	Workspace
} from '../types.ts';
import { addDays, addMonths, fmtShort } from '../domain/dates.ts';
import { parseCapture, type Parsed } from '../domain/parse.ts';
import { buildPlan, remainingMin } from '../domain/plan.ts';
import { alerts, code } from '../domain/forecast.ts';
import { blankWorkspace, exampleWorkspace, newTask, uid } from '../domain/seed.ts';
import { clock } from './clock.svelte.ts';
import { toast } from './toast.svelte.ts';
import { api, auth } from './auth.svelte.ts';
import { tierInfo } from '../tiers.ts';
import type { Column, Label } from '../types.ts';
import { STATUSES } from '../types.ts';

/** Offline cache only; MongoDB is the source of truth. */
const CACHE = (userId: string) => `pl-ws-cache:${userId}`;
const SAVE_DELAY = 600;
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
	// A task waiting on "Did you complete this?" is paused until it's answered.
	plan = $derived(
		buildPlan(
			this.tasks.filter((t) => t.id !== this.data?.awaiting?.taskId),
			this.meetings,
			this.data?.settings ?? blankWorkspace(clock.today).settings,
			clock.now,
			this.data?.active ?? null
		)
	);
	alerts = $derived(
		this.data ? alerts(this.tasks, this.projects, this.plan, this.data.settings, clock.today) : []
	);
	tier = $derived(tierInfo(auth.user?.tier));
	columns = $derived(this.data?.columns?.length ? this.data.columns : STATUSES);
	labels = $derived(this.data?.labels ?? []);
	active = $derived(this.data?.active ?? null);
	awaiting = $derived(this.data?.awaiting ?? null);
	inboxCount = $derived(this.tasks.filter((t) => t.inbox && t.status !== 'done').length);

	status = $state<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
	#version = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#inflight = false;
	#dirty = false;

	/** Load this person's plan from the server, showing the cached copy meanwhile. */
	async load(userId: string) {
		if (this.userId === userId && this.status !== 'idle' && this.status !== 'error') return;
		this.userId = userId;
		this.status = 'loading';
		this.#undo = [];
		this.canUndo = false;
		const cached = this.#readCache(userId);
		if (cached) {
			this.data = cached.data;
			this.#version = cached.version;
			this.#dirty = cached.dirty;
		}
		const r = await api<{ data: Workspace | null; version: number }>('GET', '/api/workspace');
		if (this.userId !== userId) return;
		if (!r.ok) {
			// Offline: carry on from the cache and sync when the connection returns.
			this.saving = 'offline';
			this.status = this.data ? 'ready' : 'error';
			return;
		}
		if (cached?.dirty && cached.version === r.data!.version) {
			// Unsent local edits made offline on top of the latest server copy.
			this.status = 'ready';
			this.#queue(0);
			return;
		}
		this.data = r.data!.data;
		this.#version = r.data!.version;
		this.#dirty = false;
		this.#writeCache();
		this.saving = 'synced';
		this.status = this.data ? 'ready' : 'empty';
	}

	unload() {
		if (this.#timer) clearTimeout(this.#timer);
		this.userId = null;
		this.data = null;
		this.status = 'idle';
		this.#version = 0;
		this.#dirty = false;
	}

	start(kind: 'example' | 'blank') {
		this.data = kind === 'example' ? exampleWorkspace(clock.today) : blankWorkspace(clock.today);
		this.status = 'ready';
		this.#persist();
	}

	#readCache(userId: string): { data: Workspace; version: number; dirty: boolean } | null {
		try {
			const raw = localStorage.getItem(CACHE(userId));
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	#writeCache() {
		if (!this.userId || !this.data) return;
		try {
			localStorage.setItem(
				CACHE(this.userId),
				JSON.stringify({
					data: $state.snapshot(this.data),
					version: this.#version,
					dirty: this.#dirty
				})
			);
		} catch {
			/* storage full or blocked: the server copy still saves */
		}
	}

	#persist() {
		if (!this.userId || !this.data) return;
		this.#dirty = true;
		this.saving = 'saving';
		this.#writeCache();
		this.#queue(SAVE_DELAY);
	}

	#queue(delay: number) {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#flush(), delay);
	}

	/** Send the latest copy. Edits made while a save is in flight go out right after it. */
	async #flush() {
		if (this.#inflight || !this.#dirty || !this.data || !this.userId) return;
		this.#inflight = true;
		this.#dirty = false;
		const userId = this.userId;
		const r = await api<{ version?: number; conflict?: boolean; data?: Workspace | null }>(
			'PUT',
			'/api/workspace',
			{
				data: $state.snapshot(this.data),
				version: this.#version
			}
		);
		this.#inflight = false;
		if (this.userId !== userId) return;
		if (r.ok && r.data?.version) {
			this.#version = r.data.version;
			this.saving = this.#dirty ? 'saving' : 'synced';
			this.#writeCache();
			if (this.#dirty) this.#queue(0);
			return;
		}
		if (r.status === 409 && r.data?.conflict) {
			// Another device saved first. Take its copy rather than overwrite it.
			this.data = r.data.data ?? this.data;
			this.#version = r.data.version ?? this.#version;
			this.#dirty = false;
			this.#undo = [];
			this.canUndo = false;
			this.saving = 'synced';
			this.#writeCache();
			toast('Updated from another device · your last change there won', { tone: 'err' });
			return;
		}
		if (r.status === 403) {
			// Over the plan's limit: put back the last saved copy.
			const fresh = await api<{ data: Workspace | null; version: number }>('GET', '/api/workspace');
			if (fresh.ok && fresh.data?.data) {
				this.data = fresh.data.data;
				this.#version = fresh.data.version;
				this.#writeCache();
			}
			this.saving = 'synced';
			toast(r.error ?? 'That is over your plan’s limit.', { tone: 'err' });
			return;
		}
		if (r.status === 401) {
			this.saving = 'offline';
			toast('Your session ended. Sign in again to save.', { tone: 'err' });
			return;
		}
		// Offline or a server hiccup: keep the edit and retry.
		this.#dirty = true;
		this.saving = 'offline';
		this.#writeCache();
		this.#queue(r.status === 0 ? 10_000 : 5_000);
	}

	/** Push unsent changes now (e.g. when the connection comes back). */
	retry() {
		if (this.#dirty) this.#queue(0);
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
			if (p.newProject && this.canAdd('projects')) {
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
				scope: p.personal && this.tier.personal ? 'personal' : opts.defaults?.scope,
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
				t.history = (t.history ?? []).filter((h) => h.date < clock.today || h.end <= clock.minute);
			});
			toast(`Reopened ${code(t0.code)}`, { action: 'Undo', onAction: () => this.undo() });
			return;
		}
		const planned = (this.plan.placed[id]?.blocks ?? []).map((b) => ({ ...b }));
		let msg = `Completed ${code(t0.code)}`;
		this.#change((ws) => {
			const t = ws.tasks.find((x) => x.id === id)!;
			this.#stamp(ws, t, planned);
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
					creditMin: 0,
					history: [],
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

	/** Keep a finished task's blocks on the calendar. */
	#stamp(ws: Workspace, t: Task, planned: BlockSpan[]) {
		const today = clock.today;
		const history = t.history ?? [];
		if (ws.active?.taskId === t.id) {
			const a = ws.active;
			const end = Math.min(a.end, Math.max(clock.minute, a.start + 5));
			t.history = [...history, { date: a.date, start: a.start, end }];
			ws.active = null;
		} else if (!history.some((h) => h.date === today)) {
			const blocks = planned.filter((b) => b.date === today);
			t.history = [
				...history,
				...blocks.map((b) => ({ date: b.date, start: b.start, end: b.end }))
			];
		}
		if (ws.awaiting?.taskId === t.id) ws.awaiting = null;
	}

	/**
	 * Runs each minute. Fixes the block in progress so its end can't drift; when it
	 * ends unfinished, queues "Did you complete this?" (or, if the task continues in
	 * a later block, counts the time and moves on).
	 */
	tick() {
		const ws = this.data;
		if (!ws || this.status !== 'ready') return;
		const { today, minute } = clock;
		let changed = false;
		const a = ws.active;
		if (a) {
			const t = ws.tasks.find((x) => x.id === a.taskId);
			if (!t || t.status === 'done') {
				ws.active = null;
				changed = true;
			} else if (a.date < today || a.end <= minute) {
				const len = a.end - a.start;
				t.history = [...(t.history ?? []), { date: a.date, start: a.start, end: a.end }];
				ws.active = null;
				if (remainingMin(t) > len) t.creditMin = Math.max(t.loggedMin, t.creditMin ?? 0) + len;
				else ws.awaiting = a;
				changed = true;
			}
		}
		if (!ws.active) {
			const b = (this.plan.byDate[today] ?? []).find((x) => x.start <= minute && x.end > minute);
			if (b) {
				ws.active = { taskId: b.taskId, date: b.date, start: b.start, end: b.end };
				changed = true;
			}
		}
		if (changed) this.#persist();
	}

	/** "Did you complete this?" → Yes. */
	confirmDone() {
		const a = this.data?.awaiting;
		if (a) this.complete(a.taskId);
	}

	/** "Did you complete this?" → Need more time: relight it from now. */
	moreTime(minutes: number) {
		const a = this.data?.awaiting;
		if (!a) return;
		this.#change((ws) => {
			ws.awaiting = null;
			ws.active = {
				taskId: a.taskId,
				date: clock.today,
				start: clock.minute,
				end: Math.min(1439, clock.minute + minutes)
			};
		});
		toast(`Block extended by ${minutes} min`);
	}

	/** "Did you complete this?" → Not yet: hand it back to the planner. */
	replanAwaiting() {
		const a = this.data?.awaiting;
		if (!a) return;
		this.#change((ws) => {
			ws.awaiting = null;
			const t = ws.tasks.find((x) => x.id === a.taskId);
			if (t) t.creditMin = 0;
		});
		toast('Back in the plan · schedule updated');
	}

	get version() {
		return this.#version;
	}

	/** Developer tools: end the lit block now and raise its completion prompt. */
	endActiveNow() {
		const ws = this.data;
		const a = ws?.active;
		const t = ws?.tasks.find((x) => x.id === a?.taskId);
		if (!ws || !a || !t) return;
		const ended = { ...$state.snapshot(a), end: Math.max(a.start + 1, clock.minute) };
		t.history = [...(t.history ?? []), { date: ended.date, start: ended.start, end: ended.end }];
		ws.active = null;
		ws.awaiting = ended;
		this.#persist();
	}

	// ── Board columns and labels (Pro and Ultimate) ───────────

	#columns(ws: Workspace): Column[] {
		ws.columns ??= STATUSES.map((c) => ({ ...c }));
		return ws.columns!;
	}

	addColumn(label: string) {
		this.#change((ws) => {
			const cols = this.#columns(ws);
			cols.splice(Math.max(0, cols.length - 1), 0, { id: `c-${uid()}`, label });
		});
	}

	renameColumn(id: Status, label: string) {
		this.#change((ws) => {
			const c = this.#columns(ws).find((x) => x.id === id);
			if (c) c.label = label;
		});
	}

	moveColumn(id: Status, dir: -1 | 1) {
		this.#change((ws) => {
			const cols = this.#columns(ws);
			const i = cols.findIndex((c) => c.id === id);
			const j = i + dir;
			if (i < 0 || j < 0 || j >= cols.length) return;
			const moved = cols.splice(i, 1);
			cols.splice(j, 0, ...moved.map((c) => $state.snapshot(c)));
		});
	}

	/** Backlog, In progress and Done carry meaning, so only the others can go. */
	deleteColumn(id: Status) {
		if (id === 'backlog' || id === 'doing' || id === 'done') return;
		this.#change((ws) => {
			ws.columns = this.#columns(ws).filter((c) => c.id !== id);
			for (const t of ws.tasks) if (t.status === id) t.status = 'backlog';
		});
		toast('Column deleted · its tasks moved to Backlog', {
			action: 'Undo',
			onAction: () => this.undo()
		});
	}

	addLabel(name: string, color: Label['color']): Label {
		return this.#change((ws) => {
			const label = { id: `l-${uid()}`, name, color };
			ws.labels = [...(ws.labels ?? []), label];
			return label;
		});
	}

	deleteLabel(id: string) {
		this.#change((ws) => {
			ws.labels = (ws.labels ?? []).filter((l) => l.id !== id);
			for (const t of ws.tasks) if (t.labels) t.labels = t.labels.filter((x) => x !== id);
		});
		toast('Label deleted', { action: 'Undo', onAction: () => this.undo() });
	}

	/** Whether this account may use a theme. */
	themeAllowed(t: { access: string }) {
		if (t.access === 'developer') return !!auth.user?.developer;
		return ['free', 'pro', 'ultimate'].indexOf(t.access) <= this.tier.themeLevel;
	}

	/** Whether the plan allows another project or goal. */
	canAdd(kind: 'projects' | 'goals') {
		const left = this[kind].length < this.tier[kind];
		if (!left)
			toast(`${this.tier.label} includes ${this.tier[kind]} ${kind}. Upgrade for more.`, {
				tone: 'err'
			});
		return left;
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
		const plans = new Map(
			ids.map((id) => [id, (this.plan.placed[id]?.blocks ?? []).map((b) => ({ ...b }))])
		);
		this.#change((ws) => {
			for (const t of ws.tasks)
				if (set.has(t.id)) {
					if (patch.status === 'done' && t.status !== 'done')
						this.#stamp(ws, t, plans.get(t.id) ?? []);
					Object.assign(t, patch, patch.status === 'done' ? { doneAt: clock.today } : {});
				}
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
