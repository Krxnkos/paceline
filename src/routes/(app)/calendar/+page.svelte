<script lang="ts">
	import FilterBar from '#lib/shell/FilterBar.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { filters } from '#lib/stores/filters.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { agendaFor } from '#lib/task/agenda.ts';
	import {
		addDays,
		addMonths,
		diffDays,
		fmtLong,
		fmtShort,
		minToHM,
		MONTH_LONG,
		monthStart,
		parseISO,
		patternFor,
		weekStart
	} from '#lib/domain/dates.ts';
	import { bookedMin, dayCapacity } from '#lib/domain/plan.ts';
	import { code, urgency } from '#lib/domain/forecast.ts';
	import { catSwatch } from '#lib/ui/styles.ts';
	import type { ISODate } from '#lib/types.ts';

	let month = $state(monthStart(clock.today));
	let selected = $state<ISODate>(clock.today);
	let dropOn = $state<ISODate | null>(null);

	const first = $derived(weekStart(month));
	const cells = $derived.by(() => {
		const last = addDays(addMonths(month, 1), -1);
		const n = Math.ceil((diffDays(last, first) + 1) / 7) * 7;
		return Array.from({ length: n }, (_, i) => addDays(first, i));
	});
	const title = $derived(
		`${MONTH_LONG[parseISO(month).getMonth()]} ${parseISO(month).getFullYear()}`
	);
	const s = $derived(workspace.settings);

	function itemsOn(d: ISODate) {
		const meetings = workspace.meetings
			.filter((m) => m.date === d)
			.map((m) => ({ key: m.id, kind: 'meeting' as const, label: `${m.start} ${m.title}`, m }));
		const due = workspace.tasks
			.filter((t) => (t.status === 'done' ? t.doneAt === d : t.due === d) && filters.match(t))
			.map((t) => ({ key: t.id, kind: 'task' as const, label: t.title, t }));
		return [...meetings, ...due];
	}

	function drop(e: DragEvent, d: ISODate) {
		e.preventDefault();
		dropOn = null;
		const id = e.dataTransfer?.getData('text/plain');
		const t = workspace.task(id);
		if (!t || t.due === d) return;
		workspace.updateTask(t.id, { due: d });
		toast(`${code(t.code)} due ${fmtShort(d)}`, {
			action: 'Undo',
			onAction: () => workspace.undo()
		});
	}

	const agenda = $derived(
		agendaFor(
			selected,
			workspace.plan,
			workspace.tasks,
			workspace.meetings,
			s,
			clock.minute,
			clock.today,
			workspace.awaiting
		)
	);
	const dueSel = $derived(workspace.tasks.filter((t) => t.due === selected && !t.inbox));
</script>

<svelte:head><title>Paceline · Calendar</title></svelte:head>

<div class="flex flex-col px-4 pt-2 pb-12 nav:px-8">
	<FilterBar>
		<span class="ml-auto flex items-center gap-2">
			<Button
				size="md"
				icon="chevronLeft"
				iconOnly
				aria-label="Previous month"
				onclick={() => (month = addMonths(month, -1))}
			></Button>
			<span class="min-w-40 text-center text-base font-extrabold wide">{title}</span>
			<Button
				size="md"
				icon="chevronRight"
				iconOnly
				aria-label="Next month"
				onclick={() => (month = addMonths(month, 1))}
			></Button>
			<Button
				size="md"
				onclick={() => ((month = monthStart(clock.today)), (selected = clock.today))}>Today</Button
			>
		</span>
	</FilterBar>

	<div class="mt-4 flex flex-wrap items-start gap-6">
		<div class="min-w-0 flex-[999_1_640px] overflow-x-auto">
			<div class="grid min-w-[700px] grid-cols-7 border-t border-l border-line">
				{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d (d)}
					<div class="border-r border-b border-line px-2 py-2 eyebrow">{d}</div>
				{/each}
				{#each cells as d (d)}
					{@const p = patternFor(s, d)}
					{@const inMonth = d.slice(0, 7) === month.slice(0, 7)}
					{@const items = itemsOn(d)}
					{@const cap = dayCapacity(s, workspace.meetings, d)}
					{@const booked = bookedMin(workspace.plan, d)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						role="gridcell"
						tabindex="-1"
						ondragover={(e) => {
							e.preventDefault();
							dropOn = d;
						}}
						ondragleave={() => dropOn === d && (dropOn = null)}
						ondrop={(e) => drop(e, d)}
						onclick={() => (selected = d)}
						class="relative flex min-h-[120px] cursor-pointer flex-col gap-1 border-r border-b border-line p-2 {inMonth
							? ''
							: 'opacity-40'} {p.kind !== 'work' ? 'hatch' : ''} {dropOn === d
							? 'bg-accent/10'
							: selected === d
								? 'bg-sel'
								: ''}"
					>
						<div class="flex items-center justify-between">
							<span
								class="inline-flex h-6 min-w-6 items-center justify-center px-1 text-[13px] font-extrabold wide {d ===
								clock.today
									? 'bg-accent text-accent-ink'
									: ''}">{parseISO(d).getDate()}</span
							>
							{#if p.kind === 'uni'}<span class="font-mono text-[9.5px] tracking-[0.1em] text-lilac"
									>UNI</span
								>{/if}
							{#if s.leave.includes(d)}<span
									class="font-mono text-[9.5px] tracking-[0.1em] text-muted">LEAVE</span
								>{/if}
						</div>
						{#each items.slice(0, 3) as it (it.key)}
							{#if it.kind === 'meeting'}
								<button
									type="button"
									onclick={(e) => (e.stopPropagation(), ui.openMeeting(it.m))}
									class="truncate bg-ice/12 px-1.5 py-0.5 text-left text-[11.5px] text-ice"
									>{it.label}</button
								>
							{:else}
								{@const u = urgency(it.t, clock.today)}
								<button
									type="button"
									draggable="true"
									ondragstart={(e) => e.dataTransfer?.setData('text/plain', it.t.id)}
									onclick={(e) => (e.stopPropagation(), openTask(it.t.id))}
									class="flex items-center gap-1.5 truncate border border-line-2 bg-raised px-1.5 py-0.5 text-left text-[11.5px] {it
										.t.status === 'done'
										? 'text-muted line-through'
										: u.tone === 'late'
											? 'text-flare'
											: 'text-ink-2'}"
								>
									<span class="size-1.5 flex-none {catSwatch[it.t.category]}"></span><span
										class="truncate">{it.label}</span
									>
								</button>
							{/if}
						{/each}
						{#if items.length > 3}<span class="font-mono text-[10px] text-muted"
								>+{items.length - 3} more</span
							>{/if}
						{#if cap > 0}
							<div class="mt-auto pt-1">
								<ProgressBar
									value={booked / cap}
									height={2}
									tone={booked >= cap ? 'warn' : d === clock.today ? 'lead' : 'neutral'}
									label="Booked"
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<p class="mt-3 text-[13px] text-muted">
				Drag a task chip to another day to change its due date. The bar under each day is booked
				time against capacity.
			</p>
		</div>

		<aside class="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
			<Panel title={fmtLong(selected)}>
				{#each agenda as a (a.key)}
					<button
						type="button"
						disabled={a.kind === 'lunch'}
						onclick={() =>
							a.task ? openTask(a.task.id) : a.meeting ? ui.openMeeting(a.meeting) : null}
						class="grid w-full grid-cols-[52px_2px_1fr] gap-3 px-4 py-2 text-left hover:bg-hover disabled:hover:bg-transparent {a.state ===
						'past'
							? 'opacity-50'
							: ''}"
					>
						<span class="font-mono text-xs text-muted">{minToHM(a.start)}</span>
						<span class={a.state === 'now' ? 'bg-accent' : 'bg-line-2'}></span>
						<span class="flex flex-col">
							<span
								class="text-[13.5px] {a.kind === 'meeting'
									? 'text-ice'
									: a.kind === 'lunch'
										? 'text-muted'
										: 'font-semibold'}">{a.title}</span
							>
							<span class="font-mono text-[10.5px] text-muted"
								>{minToHM(a.start)}–{minToHM(a.end)}</span
							>
						</span>
					</button>
				{:else}
					<p class="m-0 px-4 py-4 text-sm text-muted">Nothing scheduled.</p>
				{/each}
				{#if dueSel.length}
					<div class="border-t border-line px-4 pt-3 pb-1 eyebrow">Due this day</div>
					{#each dueSel as t (t.id)}
						<button
							type="button"
							onclick={() => openTask(t.id)}
							class="block w-full truncate px-4 py-1.5 text-left text-[13.5px] hover:bg-hover {t.status ===
							'done'
								? 'text-muted line-through'
								: ''}">{t.title}</button
						>
					{/each}
				{/if}
				<div class="flex gap-2 border-t border-line p-3">
					<Button size="sm" icon="plus" onclick={() => ui.openNewTask({ due: selected })}
						>Task due</Button
					>
					<Button size="sm" icon="meeting" onclick={() => ui.openMeeting(undefined, selected)}
						>Meeting</Button
					>
				</div>
			</Panel>
		</aside>
	</div>
</div>
