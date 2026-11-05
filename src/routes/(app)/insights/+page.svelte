<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Kpi from '#lib/ui/Kpi.svelte';
	import KpiRow from '#lib/ui/KpiRow.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import {
		DOW_SHORT,
		addDays,
		dow,
		fmtDayMonth,
		fmtHours,
		fmtShort,
		parseISO,
		weekStart
	} from '#lib/domain/dates.ts';
	import {
		categoryHours,
		dailyFocus,
		estimateFactor,
		hoursBy,
		onTimeRate,
		projectStats,
		upcomingLoad
	} from '#lib/domain/stats.ts';
	import { blockers } from '#lib/domain/forecast.ts';
	import { catSwatch, labelBar, panelHead } from '#lib/ui/styles.ts';

	const today = $derived(clock.today);
	const ws = $derived(weekStart(today));
	const lastWs = $derived(addDays(ws, -7));

	// ── This week against last week ───────────────────────────
	const days14 = $derived(dailyFocus(workspace.tasks, addDays(today, -13), today));
	const sum = (from: string, to: string) =>
		dailyFocus(workspace.tasks, from, to).reduce((n, d) => n + d.minutes, 0);
	const focusWeek = $derived(sum(ws, today));
	// Same point in last week, so Wednesday compares with last Wednesday.
	const focusLast = $derived(sum(lastWs, addDays(today, -7)));
	const doneIn = (from: string, to: string) =>
		workspace.tasks.filter(
			(t) => t.status === 'done' && t.doneAt && t.doneAt >= from && t.doneAt <= to
		).length;
	const doneWeek = $derived(doneIn(ws, today));
	const doneLast = $derived(doneIn(lastWs, addDays(today, -7)));
	const onTime = $derived(onTimeRate(workspace.tasks, today));
	const factor = $derived(estimateFactor(workspace.tasks));

	const delta = (now: number, before: number) => {
		const d = now - before;
		if (Math.abs(d) < 6) return 'same as last week';
		return `${d > 0 ? '+' : '−'}${fmtHours(Math.abs(d))} h on last week`;
	};

	// ── Last 14 days ──────────────────────────────────────────
	const focusMax = $derived(Math.max(60, ...days14.map((d) => d.minutes)));
	const worked = $derived(days14.filter((d) => d.minutes > 0));
	const best = $derived(
		worked.length ? worked.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null
	);
	const avg = $derived(
		worked.length ? worked.reduce((n, d) => n + d.minutes, 0) / worked.length : 0
	);

	// ── The week ahead ────────────────────────────────────────
	const ahead = $derived(
		upcomingLoad(workspace.settings, workspace.meetings, workspace.plan, today, 7)
	);
	const aheadMax = $derived(
		Math.max(60, ...ahead.map((d) => Math.max(d.capacityMin, d.bookedMin)))
	);
	const kindLabel: Record<string, string> = {
		uni: 'University',
		personal: 'Personal',
		off: 'Day off'
	};

	// ── Needs attention ───────────────────────────────────────
	const open = $derived(workspace.tasks.filter((t) => t.status !== 'done'));
	const attention = $derived([
		{
			n: open.filter((t) => !t.inbox && t.due && t.due < today).length,
			label: 'Overdue',
			hint: 'Past their due date',
			href: '/table',
			tone: 'text-flare'
		},
		{
			n: open.filter((t) => blockers(t, workspace.tasks).length).length,
			label: 'Blocked',
			hint: 'Waiting on another task or sub-task',
			href: '/board',
			tone: 'text-flare'
		},
		{
			n: workspace.plan.beyond.length,
			label: 'No room',
			hint: 'Don’t fit in the next 120 days',
			href: '/week',
			tone: 'text-amber'
		},
		{
			n: workspace.inboxCount,
			label: 'In the Inbox',
			hint: 'Captured but not planned',
			href: '/inbox',
			tone: 'text-ice'
		}
	]);

	// ── Where the time went · 30 days ─────────────────────────
	const from30 = $derived(addDays(today, -29));
	const cats = $derived(categoryHours(workspace.tasks, from30, today).filter((c) => c.hours > 0));
	const byProject = $derived(
		[...hoursBy(workspace.tasks, from30, today, (t) => [t.projectId])].map(([id, hours]) => ({
			name: id ? (workspace.project(id)?.name ?? 'Deleted project') : 'No project',
			hours
		}))
	);
	const byLabel = $derived(
		[...hoursBy(workspace.tasks, from30, today, (t) => t.labels ?? [])]
			.map(([id, hours]) => ({ l: workspace.labels.find((x) => x.id === id), hours }))
			.filter((x) => x.l)
	);
	const spentMax = $derived(
		Math.max(1, ...cats.map((c) => c.hours), ...byProject.map((p) => p.hours))
	);

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
		eyebrow="Insights · the last two weeks and the week ahead"
		title="How the time went."
		accent="What’s next."
	/>

	<KpiRow min={180}>
		<Kpi
			value={fmtHours(focusWeek)}
			unit="h"
			label="Focus this week · {delta(focusWeek, focusLast)}"
		/>
		<Kpi
			value={String(doneWeek).padStart(2, '0')}
			label="Tasks done this week · {doneLast} by now last week"
		/>
		<Kpi
			value={onTime.rate === null ? '—' : `${Math.round(onTime.rate * 100)}%`}
			label={onTime.count ? `On time · ${onTime.count} dated tasks, 30 days` : 'On time · 30 days'}
			tone="lead"
		/>
		<Kpi
			value={factor === null ? '—' : `${factor.toFixed(1)}×`}
			label={factor === null
				? 'Estimates · finish a task to see'
				: factor > 1.1
					? 'Tasks take longer than estimated'
					: factor < 0.9
						? 'Tasks take less than estimated'
						: 'Estimates are about right'}
			tone={factor && factor > 1.1 ? 'warn' : 'ink'}
		/>
	</KpiRow>

	<div class="flex flex-wrap items-stretch gap-6">
		<section
			aria-label="Focus over the last 14 days"
			class="flex min-w-0 flex-[2_1_520px] flex-col border border-line"
		>
			<div class={panelHead}>
				<span>Focus logged · last 14 days</span>
				<span>{fmtHours(days14.reduce((n, d) => n + d.minutes, 0))} h</span>
			</div>
			<div
				class="grid h-[220px] items-end gap-1.5 px-[18px] pt-5 pb-3"
				style="grid-template-columns: repeat(14, minmax(0, 1fr))"
				role="img"
				aria-label="Daily focus chart"
			>
				{#each days14 as d (d.date)}
					{@const isToday = d.date === today}
					<div
						class="flex h-full flex-col justify-end gap-1.5"
						title="{fmtShort(d.date)}: {fmtHours(d.minutes)} h"
					>
						<div class="flex h-[160px] items-end">
							<span
								class="w-full {isToday ? 'bg-accent' : d.minutes ? 'bg-ink-3' : 'bg-line'}"
								style="height: {d.minutes ? Math.max(3, (d.minutes / focusMax) * 100) : 1}%"
							></span>
						</div>
						<span
							class="text-center font-mono text-[9.5px] uppercase {isToday
								? 'text-accent-text'
								: dow(d.date) === 0 || dow(d.date) === 6
									? 'text-faint'
									: 'text-muted'}"
							>{DOW_SHORT[dow(d.date)].slice(0, 2)}<br />{parseISO(d.date).getDate()}</span
						>
					</div>
				{/each}
			</div>
			<p class="m-0 mt-auto border-t border-line px-[18px] py-3 text-sm text-ink-2">
				{#if best}
					About {fmtHours(avg)} h on the days you worked. Best day: {fmtShort(best.date)} with {fmtHours(
						best.minutes
					)} h.
				{:else}
					Nothing logged yet. Time from the focus timer and finished blocks shows up here.
				{/if}
			</p>
			<table class="sr-only">
				<caption>Focus per day</caption>
				<thead><tr><th>Day</th><th>Hours</th></tr></thead>
				<tbody>
					{#each days14 as d (d.date)}
						<tr><td>{fmtShort(d.date)}</td><td>{fmtHours(d.minutes)}</td></tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section
			aria-label="Needs attention"
			class="flex min-w-0 flex-[1_1_260px] flex-col border border-line"
		>
			<div class={panelHead}><span>Needs attention</span></div>
			{#each attention as a (a.label)}
				<a
					href={a.href}
					class="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 border-b border-line px-[18px] py-3 last:border-0 hover:bg-hover"
				>
					<span class="text-[28px] heavy leading-none {a.n ? a.tone : 'text-faint'}"
						>{String(a.n).padStart(2, '0')}</span
					>
					<span class="flex flex-col">
						<span class="text-sm font-semibold">{a.label}</span>
						<span class="text-[12.5px] text-muted">{a.hint}</span>
					</span>
				</a>
			{/each}
		</section>
	</div>

	<section aria-label="The week ahead" class="border border-line">
		<div class="{panelHead} flex-wrap">
			<span>The week ahead · planned against free time</span>
			<span class="flex gap-4">
				<span class="flex items-center gap-1.5"
					><span class="inline-block size-2.5 bg-line-3"></span>Free</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block size-2.5 bg-accent"></span>Planned</span
				>
			</span>
		</div>
		<div class="flex flex-col gap-2.5 px-[18px] py-4">
			{#each ahead as d (d.date)}
				{@const full = d.capacityMin > 0 && d.bookedMin >= d.capacityMin * 0.98}
				<div class="grid grid-cols-[86px_minmax(0,1fr)_110px] items-center gap-3">
					<span class="text-[13px] {d.date === today ? 'font-bold text-accent-text' : ''}"
						>{d.date === today ? 'Today' : `${DOW_SHORT[dow(d.date)]} ${fmtDayMonth(d.date)}`}</span
					>
					{#if d.capacityMin > 0 || d.bookedMin > 0}
						<div class="relative h-3 bg-panel">
							<div
								class="absolute inset-y-0 left-0 bg-line-3"
								style="width: {(d.capacityMin / aheadMax) * 100}%"
							></div>
							<div
								class="absolute inset-y-0 left-0 {full ? 'bg-amber' : 'bg-accent'}"
								style="width: {(d.bookedMin / aheadMax) * 100}%"
							></div>
						</div>
						<span class="text-right font-mono text-xs {full ? 'text-amber' : 'text-muted'}"
							>{fmtHours(d.bookedMin)} / {fmtHours(d.capacityMin)} h{full ? ' · full' : ''}</span
						>
					{:else}
						<div class="h-3 hatch"></div>
						<span class="text-right font-mono text-xs text-faint uppercase"
							>{kindLabel[d.kind] ?? 'No free time'}</span
						>
					{/if}
				</div>
			{/each}
		</div>
	</section>
</div>

<!-- Reading slab on the paired theme: its tokens flip -->
<div data-theme={theme.pair} class="flex flex-col gap-5 bg-canvas px-4 py-8 text-ink nav:px-8">
	<div class="flex flex-col gap-2.5">
		<div
			class="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-muted uppercase"
		>
			<span class="text-accent-text">01</span><span class="inline-block h-px w-9 bg-line-3"
			></span>Last 30 days
		</div>
		<h2 class="m-0 text-[34px] heavy leading-none">Where the time went.</h2>
	</div>
	<div class="flex flex-wrap items-stretch gap-4">
		<div class="min-w-0 flex-[1_1_280px] border border-line-2 bg-raised p-5">
			<div class="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted">BY CATEGORY</div>
			{#each cats as c (c.label)}
				<div class="grid grid-cols-[96px_1fr_48px] items-center gap-3 py-2">
					<span class="flex items-center gap-2 text-[13px]"
						><span class="size-2 {catSwatch[c.label]}"></span>{c.label}</span
					>
					<div class="h-2.5 bg-panel">
						<div class="h-2.5 bg-ink-3" style="width: {(c.hours / spentMax) * 100}%"></div>
					</div>
					<span class="text-right font-mono text-xs">{c.hours.toFixed(1)}h</span>
				</div>
			{:else}
				<p class="m-0 py-2 text-sm text-muted">No time logged in the last 30 days.</p>
			{/each}
		</div>

		<div class="min-w-0 flex-[1_1_280px] border border-line-2 bg-raised p-5">
			<div class="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted">BY PROJECT</div>
			{#each byProject.slice(0, 6) as p (p.name)}
				<div class="grid grid-cols-[minmax(0,120px)_1fr_48px] items-center gap-3 py-2">
					<span class="truncate text-[13px]">{p.name}</span>
					<div class="h-2.5 bg-panel">
						<div class="h-2.5 bg-ink-3" style="width: {(p.hours / spentMax) * 100}%"></div>
					</div>
					<span class="text-right font-mono text-xs">{p.hours.toFixed(1)}h</span>
				</div>
			{:else}
				<p class="m-0 py-2 text-sm text-muted">No time logged in the last 30 days.</p>
			{/each}
		</div>

		{#if byLabel.length}
			<div class="min-w-0 flex-[1_1_280px] border border-line-2 bg-raised p-5">
				<div class="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted">BY LABEL</div>
				{#each byLabel.slice(0, 6) as x (x.l!.id)}
					<div class="grid grid-cols-[minmax(0,120px)_1fr_48px] items-center gap-3 py-2">
						<span class="flex items-center gap-2 truncate text-[13px]"
							><span class="size-2 flex-none {labelBar[x.l!.color]}"></span>{x.l!.name}</span
						>
						<div class="h-2.5 bg-panel">
							<div
								class="h-2.5 {labelBar[x.l!.color]}"
								style="width: {(x.hours / spentMax) * 100}%"
							></div>
						</div>
						<span class="text-right font-mono text-xs">{x.hours.toFixed(1)}h</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if projects.length}
		<div class="overflow-x-auto border border-line-2 bg-raised">
			<table class="w-full min-w-[560px] border-collapse text-sm">
				<thead>
					<tr class="text-left font-mono text-[10px] tracking-[0.12em] text-muted">
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">PROJECT</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">PROGRESS</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">HOURS LEFT</th>
						<th scope="col" class="border-b border-line-2 px-4 py-3 font-medium">FINISHES</th>
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
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
