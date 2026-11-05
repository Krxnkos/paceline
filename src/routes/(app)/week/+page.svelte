<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import WeekGrid from '#lib/plan/WeekGrid.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import {
		addDays,
		DOW_SHORT,
		dow,
		fmtDayMonthLong,
		fmtHours,
		fmtShort,
		isWorkday,
		patternFor,
		weekNumber,
		weekStart
	} from '#lib/domain/dates.ts';
	import { bookedMin, dayCapacity, remainingMin } from '#lib/domain/plan.ts';
	import { blockers, forecast } from '#lib/domain/forecast.ts';

	let offset = $state(0);
	const start = $derived(addDays(weekStart(clock.today), offset * 7));
	const s = $derived(workspace.settings);
	const days = $derived(
		Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => {
			const k = dow(d);
			const kind = patternFor(s, d).kind;
			return (
				(k !== 0 && k !== 6) ||
				kind === 'work' ||
				kind === 'personal' ||
				!!workspace.plan.byDate[d]?.length
			);
		})
	);
	const workDays = $derived(days.filter((d) => isWorkday(s, d)));
	const capacity = $derived(
		workDays.reduce((n, d) => n + dayCapacity(s, workspace.meetings, d), 0)
	);
	const end = $derived(addDays(start, 6));

	// No room this week: open tasks due this week that finish later, can't be placed, or are blocked.
	const noRoom = $derived(
		workspace.tasks.filter((t) => {
			if (t.status === 'done' || t.inbox || t.quick) return false;
			const p = workspace.plan.placed[t.id];
			if (p === null) return true;
			return !!t.due && t.due >= start && t.due <= end && !!p && p.endDate > end;
		})
	);
	const loads = $derived(
		workDays.map((d) => {
			const cap = dayCapacity(s, workspace.meetings, d);
			const b = bookedMin(workspace.plan, d);
			return { d, pct: cap ? b / cap : 0 };
		})
	);
</script>

<svelte:head><title>Paceline · Week</title></svelte:head>

<div class="flex flex-col gap-[22px] px-4 pt-7 pb-12 nav:px-8">
	<PageHead
		index="03"
		eyebrow="Week {weekNumber(start)} · {workDays.length} work day{workDays.length === 1
			? ''
			: 's'} · {fmtHours(capacity)} h capacity"
		title="Week of {fmtDayMonthLong(start)}."
	>
		{#snippet actions()}
			<Button
				size="lg"
				icon="chevronLeft"
				iconOnly
				aria-label="Previous week"
				onclick={() => offset--}
			></Button>
			<Button size="lg" disabled={offset === 0} onclick={() => (offset = 0)}>This week</Button>
			<Button size="lg" icon="chevronRight" iconOnly aria-label="Next week" onclick={() => offset++}
			></Button>
			<Button
				size="lg"
				icon="meeting"
				onclick={() =>
					ui.openMeeting(
						undefined,
						start < clock.today && clock.today <= end ? clock.today : start
					)}>Meeting</Button
			>
			<Button
				size="lg"
				variant="primary"
				iconRight="arrowRight"
				onclick={() => {
					const n = workDays.reduce((k, d) => k + (workspace.plan.byDate[d]?.length ?? 0), 0);
					toast(`Week re-planned · ${n} blocks · ${noRoom.length} with no room`);
				}}>Plan week</Button
			>
		{/snippet}
	</PageHead>

	<div class="flex flex-col gap-2">
		<div
			class="flex flex-wrap gap-x-[18px] gap-y-2 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
		>
			<span class="flex items-center gap-2"
				><span class="inline-block h-2.5 w-[18px] border border-dashed border-line-3"></span>Auto ·
				may move</span
			>
			<span class="flex items-center gap-2"
				><span class="inline-block h-2.5 w-[18px] border border-ink"></span>Pinned or moved</span
			>
			<span class="flex items-center gap-2"
				><span class="inline-block h-2.5 w-[18px] bg-accent"></span>Lit block</span
			>
			<span class="flex items-center gap-2 text-flare"
				><span class="inline-block h-2.5 w-[18px] border border-flare bg-flare/12"
				></span>Blocked</span
			>
			<span class="flex items-center gap-2"
				><span class="inline-block h-2.5 w-[18px] bg-ice"></span>Meeting</span
			>
			<span class="flex items-center gap-2 text-lilac"
				><span class="inline-block h-2.5 w-[18px] border-y border-lilac/50 bg-lilac/10"
				></span>Reserved</span
			>
			<span class="flex items-center gap-2"
				><span class="relative inline-block h-2.5 w-[18px] border border-line-3"
					><span class="absolute inset-y-0 left-0 w-1 bg-lilac"></span></span
				>Label colour</span
			>
			<span class="flex items-center gap-2"
				><span class="inline-block h-0.5 w-[18px] bg-ink"></span>Now</span
			>
			<span class="flex items-center gap-2"
				><span class="inline-block h-2.5 w-[18px] border border-line hatch"></span>Not a work day</span
			>
		</div>
		<p class="m-0 text-[13px] text-muted">
			Drag a block to any time this week to keep it there. Double-click a moved block to hand it
			back to the planner. Open a task to see why it landed where it did.
		</p>
	</div>

	<div class="flex flex-wrap items-start gap-6">
		<div class="min-w-0 flex-[999_1_640px]">
			<WeekGrid {days} />
		</div>

		<aside class="flex min-w-0 flex-[1_1_260px] flex-col gap-[18px]">
			<Panel
				title="No room this week"
				meta={String(noRoom.length).padStart(2, '0')}
				metaClass={noRoom.length ? 'text-amber' : ''}
			>
				{#each noRoom as t (t.id)}
					{@const f = forecast(t, workspace.plan, workspace.tasks)}
					{@const p = workspace.plan.placed[t.id]}
					{@const waits = blockers(t, workspace.tasks)}
					<button
						type="button"
						onclick={() => openTask(t.id)}
						class="flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left hover:bg-hover"
					>
						<span class="text-sm font-semibold {waits.length ? 'text-flare' : ''}">{t.title}</span>
						<span
							class="font-mono text-[10px] uppercase {waits.length || f?.tone === 'late'
								? 'text-flare'
								: 'text-muted'}"
						>
							{#if waits.length}Blocked · waits on {waits.map((w) => w.ref).join(', ')}
							{:else if p}{remainingMin(t)} min · forecast {fmtShort(p.endDate)} · {f?.label}
							{:else}No room in 120 days{/if}
						</span>
					</button>
				{:else}
					<p class="m-0 px-4 py-4 text-sm text-muted">Everything due this week fits.</p>
				{/each}
			</Panel>

			<Panel title="Load by day">
				<div class="flex flex-col gap-3 px-4 py-3.5">
					{#each loads as l (l.d)}
						{@const tone = l.pct >= 0.98 ? 'warn' : l.d === clock.today ? 'lead' : 'ink'}
						<div class="flex flex-col gap-[5px]">
							<div class="flex justify-between text-[13px]">
								<span>{DOW_SHORT[dow(l.d)]}</span>
								<span
									class="font-mono {tone === 'warn'
										? 'text-amber'
										: tone === 'lead'
											? 'text-accent-text'
											: 'text-muted'}">{Math.round(l.pct * 100)}%</span
								>
							</div>
							<ProgressBar value={l.pct} {tone} label="{DOW_SHORT[dow(l.d)]} load" />
						</div>
					{:else}
						<p class="m-0 text-sm text-muted">No work days this week.</p>
					{/each}
				</div>
			</Panel>
			<p class="m-0 text-[13px] leading-relaxed text-muted">
				Click a block to open it. Double-click an automatic block to pin it to that day, or a pinned
				one to hand it back to the planner. Meetings open in their own editor.
			</p>
		</aside>
	</div>
</div>
