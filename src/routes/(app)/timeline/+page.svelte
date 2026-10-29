<script lang="ts">
	import FilterBar from '#lib/shell/FilterBar.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { filters } from '#lib/stores/filters.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import {
		addDays,
		diffDays,
		DOW_SHORT,
		dow,
		isWorkday,
		MONTH_SHORT,
		parseISO,
		weekStart
	} from '#lib/domain/dates.ts';
	import { code, forecast } from '#lib/domain/forecast.ts';
	import { projectStats } from '#lib/domain/stats.ts';
	import type { ISODate, Task } from '#lib/types.ts';

	type Zoom = 'days' | 'weeks' | 'months';
	let zoom = $state<Zoom>('days');
	let collapsed = $state<Record<string, boolean>>(loadCollapsed());

	function loadCollapsed(): Record<string, boolean> {
		try {
			return JSON.parse(localStorage.getItem('pl-gantt-collapsed') ?? '{}');
		} catch {
			return {};
		}
	}
	function toggleGroup(id: string) {
		collapsed = { ...collapsed, [id]: !collapsed[id] };
		try {
			localStorage.setItem('pl-gantt-collapsed', JSON.stringify(collapsed));
		} catch {
			/* storage blocked */
		}
	}

	const PX = $derived(zoom === 'days' ? 34 : zoom === 'weeks' ? 13 : 5);
	const ROW = 38;
	const GROUP = 44;
	const start = $derived(addDays(weekStart(clock.today), -7));
	const span = $derived(zoom === 'days' ? 63 : zoom === 'weeks' ? 140 : 365);
	const days = $derived(Array.from({ length: span }, (_, i) => addDays(start, i)));
	const width = $derived(span * PX);
	const x = (d: ISODate) => diffDays(d, start) * PX;

	interface Bar {
		kind: 'scheduled' | 'lead' | 'late' | 'done' | 'milestone' | 'none';
		from?: ISODate;
		to?: ISODate;
	}

	function barFor(t: Task): Bar {
		if (t.status === 'done') {
			const first = t.log.map((l) => l.date).sort()[0] ?? t.doneAt ?? t.createdAt;
			return { kind: 'done', from: first, to: t.doneAt ?? first };
		}
		const p = workspace.plan.placed[t.id];
		if (p) {
			const f = forecast(t, workspace.plan, workspace.tasks);
			const isLead = (workspace.plan.byDate[clock.today] ?? []).some(
				(b) => b.taskId === t.id && b.start <= clock.minute && b.end > clock.minute
			);
			return {
				kind: isLead ? 'lead' : f?.tone === 'late' ? 'late' : 'scheduled',
				from: p.startDate,
				to: p.endDate
			};
		}
		if (t.due) return { kind: 'milestone', from: t.due, to: t.due };
		return { kind: 'none' };
	}

	const groups = $derived.by(() => {
		const tasks = workspace.tasks.filter((t) => !t.inbox && !t.quick && filters.match(t));
		const out = workspace.projects.map((p) => ({
			id: p.id,
			code: `P-${String(p.code).padStart(2, '0')}`,
			name: p.name,
			due: p.due,
			pct: projectStats(p, workspace.tasks, workspace.plan).pct,
			tasks: tasks.filter((t) => t.projectId === p.id)
		}));
		const loose = tasks.filter((t) => !t.projectId);
		if (loose.length)
			out.push({ id: 'none', code: '—', name: 'No project', due: null, pct: 0, tasks: loose });
		return out
			.filter((g) => g.tasks.length)
			.map((g) => ({
				...g,
				tasks: [...g.tasks].sort((a, b) =>
					(barFor(a).from ?? '9').localeCompare(barFor(b).from ?? '9')
				)
			}));
	});

	// Row positions, for dependency arrows.
	const layout = $derived.by(() => {
		const rows: {
			kind: 'group' | 'task';
			y: number;
			g: (typeof groups)[number];
			t?: Task;
			bar?: Bar;
		}[] = [];
		let y = 0;
		for (const g of groups) {
			rows.push({ kind: 'group', y, g });
			y += GROUP;
			if (collapsed[g.id]) continue;
			for (const t of g.tasks) {
				rows.push({ kind: 'task', y, g, t, bar: barFor(t) });
				y += ROW;
			}
		}
		return { rows, height: y };
	});

	const arrows = $derived.by(() => {
		const pos = new Map(layout.rows.filter((r) => r.t).map((r) => [r.t!.id, r]));
		const out: { d: string; clash: boolean }[] = [];
		for (const r of layout.rows) {
			if (!r.t || !r.bar?.from) continue;
			for (const dep of r.t.deps) {
				const from = pos.get(dep);
				if (!from?.bar?.to) continue;
				const x1 = x(from.bar.to) + PX;
				const y1 = from.y + ROW / 2;
				const x2 = x(r.bar.from);
				const y2 = r.y + ROW / 2;
				const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
				out.push({ d: `M${x1} ${y1} H${mid} V${y2} H${x2 - 2}`, clash: x2 < x1 });
			}
		}
		return out;
	});

	const scale = $derived.by(() => {
		if (zoom === 'days')
			return days.map((d) => ({
				d,
				label: `${DOW_SHORT[dow(d)][0]} ${parseISO(d).getDate()}`,
				w: PX
			}));
		if (zoom === 'weeks')
			return days
				.filter((d) => dow(d) === 1)
				.map((d) => ({
					d,
					label: `${parseISO(d).getDate()} ${MONTH_SHORT[parseISO(d).getMonth()]}`,
					w: PX * 7
				}));
		return days
			.filter((d) => parseISO(d).getDate() === 1 || d === start)
			.map((d) => ({ d, label: MONTH_SHORT[parseISO(d).getMonth()].toUpperCase(), w: 0 }));
	});

	const barCls: Record<Bar['kind'], string> = {
		scheduled: 'bg-raised border border-line-3',
		lead: 'bg-accent border border-accent',
		late: 'bg-raised border border-line-3 border-r-2 border-r-flare',
		done: 'border border-dashed border-line-3',
		milestone: '',
		none: ''
	};
	let scroller: HTMLDivElement | undefined = $state();
	$effect(() => {
		void zoom;
		if (scroller) scroller.scrollLeft = Math.max(0, x(clock.today) - 160);
	});
</script>

<svelte:head><title>Paceline · Timeline</title></svelte:head>

<div class="flex flex-col px-4 pt-2 pb-12 nav:px-8">
	<FilterBar
		count="{groups.length} projects · {groups.reduce((n, g) => n + g.tasks.length, 0)} tasks"
	>
		<Segmented
			label="Zoom"
			value={zoom}
			onchange={(v) => (zoom = v)}
			options={[
				{ id: 'days', label: 'Days' },
				{ id: 'weeks', label: 'Weeks' },
				{ id: 'months', label: 'Months' }
			]}
		/>
	</FilterBar>

	<div
		bind:this={scroller}
		class="mt-4 max-h-[calc(100dvh-190px)] overflow-auto border border-line"
	>
		<div
			class="relative grid"
			style="grid-template-columns: var(--label-w) {width}px; --label-w: min(320px, 42vw)"
		>
			<!-- header -->
			<div
				class="sticky top-0 left-0 z-20 flex h-11 items-end border-r border-b border-line bg-canvas px-3 pb-2"
			>
				<span class="eyebrow"
					>{MONTH_SHORT[parseISO(clock.today).getMonth()]}
					{parseISO(clock.today).getFullYear()}</span
				>
			</div>
			<div class="sticky top-0 z-10 h-11 border-b border-line bg-canvas">
				{#each scale as s (s.d)}
					<span
						class="absolute bottom-2 font-mono text-[10px] whitespace-nowrap {s.d === clock.today
							? 'text-accent-text'
							: 'text-muted'}"
						style="left: {x(s.d) + (zoom === 'days' ? 4 : 3)}px">{s.label}</span
					>
				{/each}
			</div>

			<!-- labels -->
			<div class="sticky left-0 z-10 border-r border-line bg-canvas">
				{#each layout.rows as r (r.kind + (r.t?.id ?? r.g.id))}
					{#if r.kind === 'group'}
						<button
							type="button"
							onclick={() => toggleGroup(r.g.id)}
							aria-expanded={!collapsed[r.g.id]}
							class="flex w-full items-center gap-2.5 border-b border-line bg-panel px-3 text-left"
							style="height: {GROUP}px"
						>
							<span class="text-muted transition-transform {collapsed[r.g.id] ? '-rotate-90' : ''}"
								><Icon name="chevronDown" size={14} /></span
							>
							<span class="font-mono text-[10.5px] text-faint">{r.g.code}</span>
							<span class="truncate text-[13.5px] font-bold">{r.g.name}</span>
							{#if r.g.id !== 'none'}<span class="ml-auto font-mono text-[11px] text-muted"
									>{Math.round(r.g.pct * 100)}%</span
								>{/if}
						</button>
					{:else if r.t}
						{@const f = forecast(r.t, workspace.plan, workspace.tasks)}
						<button
							type="button"
							onclick={() => openTask(r.t!.id)}
							class="flex w-full items-center gap-2.5 border-b border-line px-3 pl-9 text-left hover:bg-hover"
							style="height: {ROW}px"
						>
							<span class="font-mono text-[10.5px] text-faint">{code(r.t.code)}</span>
							<span
								class="flex-1 truncate text-[13px] {r.t.status === 'done'
									? 'text-muted line-through'
									: ''}">{r.t.title}</span
							>
							{#if f && f.key !== 'ontime' && f.key !== 'ends'}<Badge
									tone={f.tone}
									label={f.label}
								/>{/if}
						</button>
					{/if}
				{/each}
			</div>

			<!-- chart -->
			<div class="relative" style="height: {layout.height}px">
				{#each days as d (d)}
					{#if !isWorkday(workspace.settings, d)}
						<div class="absolute inset-y-0 hatch" style="left: {x(d)}px; width: {PX}px"></div>
					{/if}
				{/each}
				{#each layout.rows as r (r.kind + (r.t?.id ?? r.g.id))}
					{#if r.kind === 'group'}
						<div
							class="absolute inset-x-0 border-b border-line bg-panel/70"
							style="top: {r.y}px; height: {GROUP}px"
						>
							{#if r.g.tasks.length}
								{@const bars = r.g.tasks.map(barFor).filter((b) => b.from)}
								{#if bars.length}
									{@const a = bars.map((b) => b.from!).sort()[0]}
									{@const z = bars
										.map((b) => b.to!)
										.sort()
										.at(-1)!}
									<div
										class="absolute top-[18px] h-2 bg-line-3"
										style="left: {x(a)}px; width: {x(z) - x(a) + PX}px"
									></div>
								{/if}
							{/if}
							{#if r.g.due}
								<div
									class="absolute top-3 h-5 w-0.5 bg-ink-3"
									style="left: {x(r.g.due) + PX - 1}px"
									title="Target"
								></div>
							{/if}
						</div>
					{:else if r.t && r.bar}
						<div
							class="absolute inset-x-0 border-b border-line/60"
							style="top: {r.y}px; height: {ROW}px"
						>
							{#if r.bar.kind === 'milestone' && r.bar.from}
								<button
									type="button"
									aria-label="{r.t.title} · due"
									onclick={() => openTask(r.t!.id)}
									class="absolute top-[13px] size-[11px] rotate-45 bg-ink-3"
									style="left: {x(r.bar.from) + PX / 2 - 5}px"
								></button>
							{:else if r.bar.from && r.bar.to}
								{@const late = r.bar.kind === 'late' && r.t.due && r.bar.to > r.t.due}
								<button
									type="button"
									aria-label={r.t.title}
									onclick={() => openTask(r.t!.id)}
									class="absolute top-2.5 h-[18px] {barCls[r.bar.kind]}"
									style="left: {x(r.bar.from) + 1}px; width: {Math.max(
										PX - 2,
										x(r.bar.to) - x(r.bar.from) + PX - 2
									)}px"
								></button>
								{#if late && r.t.due}
									<div
										class="pointer-events-none absolute top-2.5 h-[18px] border-y border-flare bg-flare/20"
										style="left: {x(r.t.due) + PX}px; width: {x(r.bar.to) - x(r.t.due)}px"
									></div>
								{/if}
							{/if}
							{#if r.t.due && r.t.status !== 'done'}
								<div
									class="absolute top-3 h-3.5 w-0.5 bg-ink"
									style="left: {x(r.t.due) + PX - 1}px"
									title="Due"
								></div>
							{/if}
						</div>
					{/if}
				{/each}

				<svg
					class="pointer-events-none absolute inset-0"
					{width}
					height={layout.height}
					aria-hidden="true"
				>
					{#each arrows as a, i (i)}
						<path
							d={a.d}
							fill="none"
							stroke={a.clash ? 'var(--flare)' : 'var(--line-3)'}
							stroke-width="1.5"
						></path>
					{/each}
				</svg>

				<div
					class="pointer-events-none absolute inset-y-0 w-0.5 bg-accent"
					style="left: {x(clock.today) + (clock.minute / 1440) * PX}px"
				></div>
			</div>
		</div>
		{#if !groups.length}
			<p class="m-0 py-12 text-center text-sm text-muted">
				Nothing to draw yet. Plan a task with a project and it appears here.
			</p>
		{/if}
	</div>
	<div
		class="mt-3 flex flex-wrap gap-4 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase"
	>
		<span class="flex items-center gap-2"
			><span class="inline-block h-2.5 w-5 border border-line-3 bg-raised"></span>Scheduled</span
		>
		<span class="flex items-center gap-2"
			><span class="inline-block h-2.5 w-5 bg-accent"></span>Lead</span
		>
		<span class="flex items-center gap-2"
			><span class="inline-block h-2.5 w-5 border-y border-flare bg-flare/20"></span>Late overrun</span
		>
		<span class="flex items-center gap-2"
			><span class="inline-block h-2.5 w-5 border border-dashed border-line-3"></span>Done</span
		>
		<span class="flex items-center gap-2"
			><span class="inline-block size-2 rotate-45 bg-ink-3"></span>Due only</span
		>
		<span class="flex items-center gap-2"
			><span class="inline-block h-3 w-0.5 bg-ink"></span>Due date</span
		>
	</div>
</div>
