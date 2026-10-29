<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { blockers, code, urgency } from '#lib/domain/forecast.ts';
	import { score } from '#lib/domain/plan.ts';
	import { fmtDur } from '#lib/domain/dates.ts';
	import { catBorder } from '#lib/ui/styles.ts';
	import { STATUSES, type Status, type Task } from '#lib/types.ts';

	let proj = $state<string>('all');
	let showAllDone = $state(false);
	let dragId = $state<string | null>(null);
	let over = $state<Status | null>(null);

	const notes: Record<Status, string> = {
		backlog: 'Ranked by priority',
		next: 'Planner picks from here',
		doing: '',
		review: 'Waiting on a check',
		done: 'Recent first'
	};

	const visible = $derived(
		workspace.tasks.filter(
			(t) => !t.inbox && (proj === 'all' || (proj === 'none' ? !t.projectId : t.projectId === proj))
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
		STATUSES.map((s) => {
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
		const i = STATUSES.findIndex((s) => s.id === t.status);
		const next = STATUSES[Math.max(0, Math.min(STATUSES.length - 1, i + dir))];
		setStatus(t, next.id);
	}

	function setStatus(t: Task, status: Status) {
		if (t.status === status) return;
		workspace.setStatus(t.id, status);
		const label = STATUSES.find((s) => s.id === status)!.label;
		if (status !== 'done')
			toast(`${code(t.code)} moved to ${label} · schedule re-planned`, {
				action: 'Undo',
				onAction: () => workspace.undo()
			});
	}

	function drop(e: DragEvent, status: Status) {
		e.preventDefault();
		over = null;
		const id = e.dataTransfer?.getData('text/plain') || dragId;
		const t = workspace.task(id);
		if (t) setStatus(t, status);
		dragId = null;
	}

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
		{/snippet}
	</PageHead>

	<div class="overflow-x-auto">
		<div class="grid min-w-[1040px] grid-cols-5 items-start gap-3">
			{#each lanes as lane (lane.id)}
				<section
					aria-label={lane.label}
					ondragover={(e) => {
						e.preventDefault();
						over = lane.id;
					}}
					ondragleave={() => over === lane.id && (over = null)}
					ondrop={(e) => drop(e, lane.id)}
					class="flex min-h-[640px] flex-col gap-2.5 border border-line p-2.5 transition-colors {over ===
					lane.id
						? 'bg-accent/10'
						: 'bg-panel'}"
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
							draggable="true"
							ondragstart={(e) => {
								dragId = t.id;
								e.dataTransfer?.setData('text/plain', t.id);
							}}
							ondragend={() => ((dragId = null), (over = null))}
							class="flex cursor-grab flex-col gap-2.5 border-t-[3px] bg-surface p-3 active:cursor-grabbing {catBorder[
								t.category
							]} {lead ? 'outline-2 -outline-offset-2 outline-accent' : ''} {dragId === t.id
								? 'opacity-40'
								: ''}"
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
									: 'text-ink'}">{t.title}</button
							>
							{#if waits.length && !done}
								<span class="font-mono text-[10px] text-flare uppercase"
									>Waits on {waits.map((w) => code(w.code)).join(', ')}</span
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
										disabled={t.status === 'backlog'}
										aria-label="Move {t.title} left"
										class="inline-flex size-8 items-center justify-center border border-line-3 text-ink hover:bg-hover disabled:opacity-30"
										><Icon name="chevronLeft" size={14} /></button
									>
									<button
										type="button"
										onclick={() => move(t, 1)}
										disabled={done}
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
