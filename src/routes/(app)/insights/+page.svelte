<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Kpi from '#lib/ui/Kpi.svelte';
	import KpiRow from '#lib/ui/KpiRow.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import { addDays, fmtDayMonth, fmtHours, fmtShort, weekStart } from '#lib/domain/dates.ts';
	import {
		categoryHours,
		estimateFactor,
		loggedHours,
		onTimeRate,
		otjHours,
		projectStats,
		weeklyLoad
	} from '#lib/domain/stats.ts';
	import { catSwatch, panelHead } from '#lib/ui/styles.ts';

	const today = $derived(clock.today);
	const weeks = $derived(
		weeklyLoad(workspace.settings, workspace.meetings, workspace.plan, today, 12)
	);
	const last = $derived(addDays(weeks.at(-1)!.start, 6));
	const focus7 = $derived(loggedHours(workspace.tasks, addDays(today, -6), today));
	const ws = $derived(weekStart(today));
	const doneWeek = $derived(
		workspace.tasks.filter((t) => t.status === 'done' && t.doneAt && t.doneAt >= ws).length
	);
	const onTime = $derived(onTimeRate(workspace.tasks, today));
	const factor = $derived(estimateFactor(workspace.tasks));
	const max = $derived(Math.max(60, ...weeks.map((w) => Math.max(w.capacityMin, w.bookedMin))));
	const overloaded = $derived(
		weeks.filter((w) => w.bookedMin > w.capacityMin * 0.98 && w.capacityMin > 0)
	);
	const cats = $derived(categoryHours(workspace.tasks, addDays(today, -29), today));
	const catMax = $derived(Math.max(1, ...cats.map((c) => c.hours)));
	const otj = $derived(otjHours(workspace.settings, workspace.tasks, today));
	const otjRate = $derived.by(() => {
		// Hours per week over the last 8 weeks, to estimate how long until the target.
		const recent =
			otjHours({ ...workspace.settings, otjStart: addDays(today, -56) }, workspace.tasks, today)
				.total / 8;
		const left = Math.max(0, workspace.settings.otjTarget - otj.total);
		return recent > 0 ? Math.ceil(left / recent) : null;
	});
	const projects = $derived(
		workspace.projects.map((p) => ({ p, s: projectStats(p, workspace.tasks, workspace.plan) }))
	);
	const healthCls: Record<string, string> = {
		'On track': 'bg-accent-text text-raised',
		'At risk': 'bg-amber text-signal-ink',
		'Off track': 'bg-flare text-signal-ink',
		Complete: 'bg-ink text-canvas',
		'Not started': 'border border-line-3 text-muted'
	};
</script>

<svelte:head><title>Paceline · Insights</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-8 nav:px-8">
	<PageHead
		index="10"
		eyebrow="Insights · forecast to {fmtDayMonth(last)}"
		title="Twelve weeks."
		accent="No blind spots."
	/>

	<KpiRow min={180}>
		<Kpi value={fmtHours(focus7 * 60)} unit="h" label="Focus · last 7 days" />
		<Kpi value={String(doneWeek).padStart(2, '0')} label="Tasks done this week" />
		<Kpi
			value={onTime.rate === null ? '—' : `${Math.round(onTime.rate * 100)}%`}
			label="On time · 30 days"
			tone="lead"
		/>
		<Kpi
			value={factor === null ? '—' : `${factor.toFixed(2)}×`}
			label="Actual ÷ estimate"
			tone={factor && factor > 1.1 ? 'warn' : 'ink'}
		/>
	</KpiRow>

	<section aria-label="Capacity against forecast work" class="border border-line">
		<div class="{panelHead} flex-wrap">
			<span>Free capacity vs forecast work · hours per week</span>
			<span class="flex gap-4">
				<span class="flex items-center gap-1.5"
					><span class="inline-block size-2.5 bg-line-3"></span>Capacity</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block size-2.5 bg-accent"></span>Forecast</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block size-2.5 bg-ice"></span>Meetings</span
				>
			</span>
		</div>
		<div class="overflow-x-auto">
			<div
				class="grid h-[260px] min-w-[760px] grid-cols-12 items-end gap-2.5 px-[18px] pt-5 pb-3.5"
				role="img"
				aria-label="Weekly capacity chart"
			>
				{#each weeks as w, i (w.start)}
					{@const over = w.capacityMin > 0 && w.bookedMin > w.capacityMin * 0.98}
					<div
						class="flex h-full flex-col justify-end gap-1.5"
						title="{fmtDayMonth(w.start)}: {fmtHours(w.bookedMin)} h booked of {fmtHours(
							w.capacityMin
						)} h · meetings {fmtHours(w.meetingMin)} h"
					>
						<div class="flex h-[200px] items-end gap-[3px]">
							<span class="flex-1 bg-line-3" style="height: {(w.capacityMin / max) * 100}%"></span>
							<span
								class="flex-1 {over ? 'bg-flare' : 'bg-accent'}"
								style="height: {(w.bookedMin / max) * 100}%"
							></span>
							<span class="w-1 flex-none bg-ice" style="height: {(w.meetingMin / max) * 100}%"
							></span>
						</div>
						<span
							class="text-center font-mono text-[10px] uppercase {i === 0
								? 'text-accent-text'
								: over
									? 'text-flare'
									: w.capacityMin
										? 'text-muted'
										: 'text-faint'}">{fmtDayMonth(w.start)}</span
						>
					</div>
				{/each}
			</div>
		</div>
		<div class="flex items-center gap-2.5 border-t border-line px-[18px] py-3 text-sm text-ink-2">
			<span class="size-1.5 flex-none {overloaded.length ? 'bg-flare' : 'bg-accent'}"></span>
			{#if overloaded.length}
				Week of {fmtDayMonth(overloaded[0].start)} is overloaded by {fmtHours(
					Math.max(0, overloaded[0].bookedMin - overloaded[0].capacityMin) || 0,
					1
				)} h. Leave and non-working days are already counted.
			{:else}
				Every week has room. Leave and non-working days are already counted.
			{/if}
		</div>
		<table class="sr-only">
			<caption>Hours per week</caption>
			<thead><tr><th>Week</th><th>Capacity</th><th>Forecast</th><th>Meetings</th></tr></thead>
			<tbody>
				{#each weeks as w (w.start)}
					<tr
						><td>{fmtDayMonth(w.start)}</td><td>{fmtHours(w.capacityMin)}</td><td
							>{fmtHours(w.bookedMin)}</td
						><td>{fmtHours(w.meetingMin)}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</section>
</div>

<!-- Reading slab on the paired theme: its tokens flip -->
<div data-theme={theme.pair} class="flex flex-col gap-5 bg-canvas px-4 py-8 text-ink nav:px-8">
	<div class="flex flex-col gap-2.5">
		<div
			class="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-muted uppercase"
		>
			<span class="text-accent-text">01</span><span class="inline-block h-px w-9 bg-line-3"
			></span>Projects &amp; training
		</div>
		<h2 class="m-0 text-[34px] heavy leading-none">Who’s at the front.</h2>
	</div>
	<div class="flex flex-wrap items-stretch gap-4">
		<div class="min-w-0 flex-[2_1_520px] overflow-x-auto border border-line-2 bg-raised">
			<table class="w-full min-w-[560px] border-collapse text-sm">
				<thead>
					<tr class="text-left font-mono text-[10px] tracking-[0.12em] text-muted">
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">PROJECT</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">PROGRESS</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">HOURS LEFT</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">FORECAST</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">HEALTH</th>
					</tr>
				</thead>
				<tbody>
					{#each projects as { p, s } (p.id)}
						<tr class="border-b border-line last:border-0">
							<th scope="row" class="px-4 py-3.5 text-left font-bold"
								><a href="/projects/{p.id}" class="text-ink hover:underline">{p.name}</a></th
							>
							<td class="px-4 py-3.5">
								<div class="flex items-center gap-2.5">
									<div class="w-[120px]">
										<ProgressBar
											value={s.pct}
											tone="ink"
											track="bg-panel"
											label="{p.name} progress"
										/>
									</div>
									<span class="font-mono text-xs">{Math.round(s.pct * 100)}%</span>
								</div>
							</td>
							<td class="px-4 py-3.5 font-mono">{fmtHours(s.remainingMin)}</td>
							<td
								class="px-4 py-3.5 font-mono whitespace-nowrap uppercase {p.due &&
								s.finish &&
								s.finish > p.due
									? 'text-flare'
									: ''}">{s.finish ? fmtShort(s.finish) : '—'}</td
							>
							<td class="px-4 py-3.5"
								><span
									class="px-[7px] py-[3px] font-mono text-[10px] font-bold whitespace-nowrap uppercase {healthCls[
										s.health
									]}">{s.health}</span
								></td
							>
						</tr>
					{:else}
						<tr><td colspan="5" class="px-4 py-6 text-center text-muted">No projects yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div
			data-theme={theme.resolved}
			class="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 bg-canvas p-5 text-ink"
		>
			<div class="flex justify-between font-mono text-[10px] tracking-[0.14em] text-muted">
				<span>OFF-THE-JOB HOURS</span><span>T.01</span>
			</div>
			<div class="text-[42px] heavy leading-none">
				{Math.round(otj.total)}<span class="text-lg text-muted">
					/ {workspace.settings.otjTarget} h</span
				>
			</div>
			<ProgressBar
				value={otj.total / workspace.settings.otjTarget}
				tone="lead"
				height={8}
				label="Off-the-job hours"
			/>
			<div class="text-[13px] leading-normal text-ink-3">
				{Math.round(otj.uni)} h from University days and {fmtHours(otj.logged * 60)} h of logged study.
				{#if otj.total >= workspace.settings.otjTarget}Target reached.{:else if otjRate}About {otjRate}
					week{otjRate === 1 ? '' : 's'} to go at your current rate.{/if}
			</div>
			<a
				href="/settings"
				class="font-mono text-[10px] tracking-[0.08em] text-faint uppercase hover:text-ink"
				>Target and start date set in Settings</a
			>
		</div>

		<div class="min-w-0 flex-[1_1_280px] border border-line-2 bg-raised p-5">
			<div class="mb-2 flex justify-between font-mono text-[10px] tracking-[0.14em] text-muted">
				<span>LOGGED BY CATEGORY · 30 DAYS</span>
			</div>
			{#each cats as c (c.label)}
				<div class="grid grid-cols-[96px_1fr_48px] items-center gap-3 py-2">
					<span class="flex items-center gap-2 text-[13px]"
						><span class="size-2 {catSwatch[c.label]}"></span>{c.label}</span
					>
					<div class="h-2.5 bg-panel">
						<div class="h-2.5 bg-ink-3" style="width: {(c.hours / catMax) * 100}%"></div>
					</div>
					<span class="text-right font-mono text-xs">{c.hours.toFixed(1)}h</span>
				</div>
			{/each}
		</div>
	</div>
</div>
