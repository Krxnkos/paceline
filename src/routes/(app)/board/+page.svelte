<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { pointerDrag } from '#lib/ui/pointerDrag.ts';
	import Badge from '#lib/ui/Badge.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { blockers, code, urgency } from '#lib/domain/forecast.ts';
	import { score } from '#lib/domain/plan.ts';
	import { fmtDur } from '#lib/domain/dates.ts';
	import { catBorder } from '#lib/ui/categories.ts';
	import BoardSetup from '#lib/task/BoardSetup.svelte';
	import { labelCls } from '#lib/ui/styles.ts';
	import type { Status, Task } from '#lib/types.ts';

	let proj = $state<string>('all');
	let labelFilter = $state<string>('all');
	let setup = $state(false);
	let showAllDone = $state(false);
	let dragId = $state<string | null>(null);
	let over = $state<Status | null>(null);

	const notes: Record<string, string> = {
		backlog: 'Ranked by priority',
		next: 'Planner picks from here',
		doing: '',
		review: 'Waiting on a check',
		done: 'Recent first'
	};

	const visible = $derived(
		workspace.tasks.filter(
			(t) =>
				(labelFilter === 'all' || !!t.labels?.includes(labelFilter)) &&
				!t.inbox &&
				(proj === 'all' || (proj === 'none' ? !t.projectId : t.projectId === proj))
		)
	);
	const ranks = $derived(
		new Map(
			workspace.tasks
				.filter((t) => t.status !== 'done' && !t.inbox)
				.sort((a, b) => score(b, clock.today) - score(a, clock.today))
				.map((t, i) => [t.id, i + 1])
		)
	);
	const leadId = $derived.by(() => {
		const b = (workspace.plan.byDate[clock.today] ?? []).find((x) => x.end > clock.minute);
		return b?.taskId ?? null;
	});
	const lanes = $derived(
		workspace.columns.map((s) => {
			let cards = visible.filter((t) => t.status === s.id);
			if (s.id === 'done')
				cards = cards.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
			else cards = cards.sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0));
			const total = cards.length;
			if (s.id === 'done' && !showAllDone) cards = cards.slice(0, 8);
			const overWip = s.id === 'doing' && total > workspace.settings.wipLimit;
			return { ...s, cards, total, overWip };
		})
	);

	function move(t: Task, dir: -1 | 1) {
		const cols = workspace.columns;
		const next =
			cols[Math.max(0, Math.min(cols.length - 1, cols.findIndex((s) => s.id === t.status) + dir))];
		setStatus(t, next.id);
	}

	function setStatus(t: Task, status: Status) {
		if (t.status === status) return;
		workspace.setStatus(t.id, status);
		const label = workspace.columns.find((s) => s.id === status)?.label ?? status;
		if (status !== 'done')
			toast(`${code(t.code)} moved to ${label} · schedule re-planned`, {
				action: 'Undo',
				onAction: () => workspace.undo()
			});
	}

	// Cards follow the pointer (mouse, pen or finger); the column under it lights up.
	const laneEls: Record<string, HTMLElement> = {};
	let ghost = $state<{ title: string; x: number; y: number } | null>(null);

	function laneAt(x: number, y: number): Status | null {
		for (const [id, el] of Object.entries(laneEls)) {
			const r = el?.getBoundingClientRect();
			if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id as Status;
		}
		return null;
	}

	function cardDrag(t: { id: string; title: string }) {
		return {
			enabled: true,
			scroll: () => [boardScroller],
			callbacks: {
				start: (e: PointerEvent) => {
					dragId = t.id;
					ghost = { title: t.title, x: e.clientX, y: e.clientY };
				},
				move: (e: PointerEvent) => {
					ghost = { title: t.title, x: e.clientX, y: e.clientY };
					over = laneAt(e.clientX, e.clientY);
				},
				end: (_e: PointerEvent | null, cancelled: boolean) => {
					const id = dragId;
					const to = over;
					dragId = null;
					over = null;
					ghost = null;
					const task = workspace.task(id);
					if (!cancelled && task && to && task.status !== to) setStatus(task, to);
				}
			}
		};
	}
	let boardScroller: HTMLElement | undefined = $state();

	const filters = $derived([
		{ id: 'all', label: 'All' },
		...workspace.projects.map((p) => ({ id: p.id, label: p.name })),
		{ id: 'none', label: 'No project' }
	]);
	const countLabel = $derived(`${visible.filter((t) => t.status !== 'done').length} open tasks`);
</script>

<svelte:head><title>Paceline · Board</title></svelte:head>

<div class="flex flex-col gap-[22px] px-4 pt-7 pb-12 nav:px-8">
	<PageHead index="05" eyebrow="Board · {countLabel}" title="Work in formation.">
		{#snippet actions()}
			<div role="group" aria-label="Filter by project" class="flex flex-wrap gap-1.5">
				{#each filters as f (f.id)}
					<button
						type="button"
						aria-pressed={proj === f.id}
						onclick={() => (proj = f.id)}
						class="h-10 border px-3.5 text-[13px] font-bold transition-colors {proj === f.id
							? 'border-ink bg-ink text-canvas'
							: 'border-line-3 text-ink-2 hover:border-ink-3 hover:text-ink'}">{f.label}</button
					>
				{/each}
			</div>
			{#if workspace.labels.length}
				<select
					bind:value={labelFilter}
					aria-label="Filter by label"
					class="h-10 border border-line-3 bg-transparent px-2 text-[13px] font-bold text-ink-2"
				>
					<option value="all">All labels</option>
					{#each workspace.labels as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
				</select>
			{/if}
			<button
				type="button"
				onclick={() =>
					workspace.tier.customBoard
						? (setup = true)
						: toast('Custom columns and labels are included in Pro.', { tone: 'err' })}
				class="inline-flex h-10 items-center gap-2 border border-line-3 px-3.5 text-[13px] font-bold text-ink-2 hover:text-ink"
				><Icon name="edit" size={14} />Customise{workspace.tier.customBoard ? '' : ' · Pro'}</button
			>
		{/snippet}
	</PageHead>
	<BoardSetup bind:open={setup} />

	<div class="overflow-x-auto" bind:this={boardScroller}>
		<div
			class="grid items-start gap-3"
			style="grid-template-columns: repeat({lanes.length}, minmax(208px, 1fr))"
		>
			{#each lanes as lane (lane.id)}
				<section
					aria-label={lane.label}
					bind:this={laneEls[lane.id]}
					class="flex min-h-[640px] flex-col gap-2.5 border p-2.5 transition-[background-color,border-color] duration-200 {over ===
					lane.id
						? 'border-accent-text bg-accent/10'
						: 'border-line bg-panel'}"
				>
					<div
						class="flex flex-col gap-1 border-b-2 px-1 pt-1.5 pb-2.5 {lane.overWip
							? 'border-flare'
							: lane.id === 'doing'
								? 'border-accent'
								: lane.id === 'done'
									? 'border-ink'
									: lane.id === 'review'
										? 'border-ice'
										: 'border-line-3'}"
					>
						<div class="flex items-baseline justify-between">
							<span class="text-[15px] font-extrabold wide">{lane.label}</span>
							<span class="font-mono text-xs {lane.overWip ? 'text-flare' : 'text-muted'}"
								>{String(lane.total).padStart(2, '0')}</span
							>
						</div>
						<span
							class="font-mono text-[10px] tracking-[0.08em] uppercase {lane.overWip
								? 'text-flare'
								: 'text-faint'}"
						>
							{lane.id === 'doing'
								? lane.overWip
									? `Over WIP ${lane.total}/${workspace.settings.wipLimit} · finish something first`
									: `WIP ${lane.total}/${workspace.settings.wipLimit}`
								: notes[lane.id]}
						</span>
					</div>

					{#each lane.cards as t (t.id)}
						{@const done = t.status === 'done'}
						{@const u = urgency(t, clock.today)}
						{@const waits = blockers(t, workspace.tasks)}
						{@const rank = ranks.get(t.id)}
						{@const lead = t.id === leadId}
						{@const tp = workspace.project(t.projectId)}
						<article
							use:pointerDrag={cardDrag(t)}
							animate:flip={{ duration: 260, easing: cubicOut }}
							in:fade={{ duration: 180 }}
							class="pl-lift flex cursor-grab flex-col gap-2.5 border-t-[3px] p-3 select-none {waits.length &&
							!done
								? 'border border-flare border-t-flare bg-flare/8'
								: `bg-surface ${catBorder(t.category)}`} {lead
								? 'outline-2 -outline-offset-2 outline-accent'
								: ''} {dragId === t.id ? 'opacity-40' : ''}"
						>
							<div
								class="flex justify-between gap-2 font-mono text-[10px] tracking-[0.04em] text-muted uppercase"
							>
								<span class="truncate"
									>{code(t.code)} · {t.category}{tp ? ` · ${tp.name}` : ''}</span
								>
								<span class={!done && rank && rank <= 3 ? 'text-accent-text' : ''}
									>{done ? '✓' : `#${rank}`}</span
								>
							</div>
							<button
								type="button"
								onclick={() => openTask(t.id)}
								class="text-left text-sm leading-snug font-bold hover:underline {done
									? 'text-muted line-through'
									: waits.length
										? 'text-flare'
										: 'text-ink'}">{t.title}</button
							>
							{#if t.labels?.length}
								<div class="flex flex-wrap gap-1">
									{#each workspace.labels.filter((l) => t.labels?.includes(l.id)) as l (l.id)}
										<span class="border px-1.5 py-px text-[11px] font-semibold {labelCls[l.color]}"
											>{l.name}</span
										>
									{/each}
								</div>
							{/if}
							{#if t.scope === 'personal'}
								<span class="font-mono text-[10px] tracking-[0.08em] text-lilac uppercase"
									>Personal</span
								>
							{/if}
							{#if waits.length && !done}
								<span class="font-mono text-[10px] text-flare uppercase"
									>■ Blocked · waits on {waits.map((w) => w.ref).join(', ')}</span
								>
							{/if}
							<div class="flex items-center justify-between gap-1.5">
								<span class="flex items-center gap-2">
									<Badge fill tone={done ? 'lead' : u.tone} label={done ? 'Done' : u.label} />
									<span class="font-mono text-[10px] text-muted">{fmtDur(t.estimateMin)}</span>
									{#if t.subtasks.length}<span class="font-mono text-[10px] text-muted"
											>☐ {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span
										>{/if}
								</span>
								<span class="flex gap-1">
									<button
										type="button"
										onclick={() => move(t, -1)}
										disabled={t.status === workspace.columns[0].id}
										aria-label="Move {t.title} left"
										class="inline-flex size-8 items-center justify-center border border-line-3 text-ink hover:bg-hover disabled:opacity-30"
										><Icon name="chevronLeft" size={14} /></button
									>
									<button
										type="button"
										onclick={() => move(t, 1)}
										disabled={t.status === workspace.columns.at(-1)?.id}
										aria-label="Move {t.title} right"
										class="inline-flex size-8 items-center justify-center border border-line-3 text-ink hover:bg-hover disabled:opacity-30"
										><Icon name="chevronRight" size={14} /></button
									>
								</span>
							</div>
						</article>
					{/each}

					{#if lane.id === 'done' && lane.total > 8}
						<button
							type="button"
							class="h-9 font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:text-ink"
							onclick={() => (showAllDone = !showAllDone)}
							>{showAllDone ? 'Show recent' : `Show all ${lane.total}`}</button
						>
					{/if}
					{#if lane.id !== 'done'}
						<button
							type="button"
							onclick={() =>
								ui.openNewTask({
									status: lane.id,
									...(proj !== 'all' && proj !== 'none' ? { projectId: proj } : {})
								})}
							class="flex h-10 items-center justify-center gap-2 border border-dashed border-line-2 text-[13px] text-muted hover:border-line-3 hover:text-ink"
							><Icon name="plus" size={14} />Add task</button
						>
					{/if}
				</section>
			{/each}
		</div>
	</div>
</div>

{#if ghost}
	<div
		class="shadow-2xl pointer-events-none fixed z-[95] w-[220px] -translate-x-1/2 -translate-y-1/2 rotate-[1.5deg] border-2 border-ink bg-raised px-3 py-2.5 text-[13.5px] font-bold"
		style="left: {ghost.x}px; top: {ghost.y}px"
	>
		<span class="line-clamp-2">{ghost.title}</span>
		<span class="font-mono text-[10px] font-normal text-muted uppercase"
			>{over
				? `→ ${workspace.columns.find((c) => c.id === over)?.label}`
				: 'Drop on a column'}</span
		>
	</div>
{/if}
