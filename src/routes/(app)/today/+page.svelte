<script lang="ts">
	import { goto } from '$app/navigation';
	import CaptureBar from '#lib/task/CaptureBar.svelte';
	import NowCard from '#lib/task/NowCard.svelte';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Kpi from '#lib/ui/Kpi.svelte';
	import KpiRow from '#lib/ui/KpiRow.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { agendaFor, type AgendaItem } from '#lib/task/agenda.ts';
	import { fmtHours, fmtLong, minToHM, patternFor } from '#lib/domain/dates.ts';
	import { bookedMin, dayCapacity, freeIntervals } from '#lib/domain/plan.ts';
	import { mustDos, urgency } from '#lib/domain/forecast.ts';

	const today = $derived(clock.today);
	const s = $derived(workspace.settings);
	const pattern = $derived(patternFor(s, today));
	const agenda = $derived(
		agendaFor(
			today,
			workspace.plan,
			workspace.tasks,
			workspace.meetings,
			s,
			clock.minute,
			today,
			workspace.awaiting
		)
	);
	const capacity = $derived(dayCapacity(s, workspace.meetings, today));
	const booked = $derived(bookedMin(workspace.plan, today));

	const eyebrow = $derived(
		pattern.kind === 'work'
			? `Work day · ${pattern.start}–${pattern.end} · ${fmtHours(capacity)} h plannable`
			: pattern.kind === 'uni'
				? `University day · off-the-job ${pattern.otjHours} h`
				: s.leave.includes(today)
					? 'On leave · nothing planned'
					: 'Day off · nothing planned'
	);

	const open = $derived(workspace.tasks.filter((t) => t.status !== 'done'));
	const overdue = $derived(open.filter((t) => !t.inbox && t.due && t.due < today).length);
	const dueToday = $derived(open.filter((t) => t.due === today).length);
	const focusToday = $derived(
		workspace.tasks.reduce(
			(n, t) => n + t.log.filter((l) => l.date === today).reduce((m, l) => m + l.minutes, 0),
			0
		)
	);

	// Lead block: the one running now, else the next one up.
	const blocks = $derived(
		agenda.filter((a) => a.kind === 'block' && !a.history && a.state !== 'past')
	);
	const lead = $derived(blocks.find((a) => a.state === 'now') ?? blocks[0] ?? null);
	const nextItem = $derived(
		agenda.find((a) => a.state === 'future' && a !== lead && a.kind !== 'lunch') ?? null
	);
	const quick = $derived(
		workspace.tasks
			.filter((t) => t.quick && (t.status !== 'done' || t.doneAt === today))
			.sort((a, b) => a.estimateMin - b.estimateMin)
	);
	const gap = $derived.by(() => {
		let free = freeIntervals(s, workspace.meetings, today).map(
			([a, b]) => [Math.max(a, clock.minute), b] as [number, number]
		);
		for (const b of workspace.plan.byDate[today] ?? [])
			free = free.flatMap(([a, e]) =>
				b.end <= a || b.start >= e
					? [[a, e]]
					: [
							[a, b.start],
							[b.end, e]
						].filter(([x, y]) => y > x)
			) as [number, number][];
		const g = free.find(([a, b]) => b - a >= 10);
		if (!g) return null;
		const fits = quick.find((t) => t.status !== 'done' && t.estimateMin <= g[1] - g[0]) ?? null;
		return { start: g[0], fits };
	});

	const musts = $derived(mustDos(workspace.tasks, workspace.plan, today));
	const firstThreeDone = $derived(musts.slice(0, 3).every((t) => t.status === 'done'));
	const mustLeft = $derived(musts.slice(0, 3).filter((t) => t.status !== 'done').length);
	const quickOpenMin = $derived(
		quick.filter((t) => t.status !== 'done').reduce((n, t) => n + t.estimateMin, 0)
	);
	const lateCount = $derived(workspace.alerts.filter((a) => a.tone === 'late').length);
	const nextMeeting = $derived(agenda.find((a) => a.kind === 'meeting' && a.state === 'future'));

	function blockStyle(a: AgendaItem): { box: string; tag: string; meta: string; time: string } {
		const mins = a.end - a.start;
		if (a.kind === 'meeting')
			return {
				box:
					'bg-ice border-ice text-signal-ink font-bold' + (a.state === 'past' ? ' opacity-50' : ''),
				tag: 'MEETING',
				meta: `${mins} MIN · FIXED`,
				time: 'text-muted'
			};
		if (a.kind === 'lunch')
			return {
				box: 'bg-surface border-surface text-muted font-medium',
				tag: 'PROTECTED',
				meta: 'LUNCH',
				time: 'text-muted'
			};
		if (a.done)
			return {
				box: 'border-line text-muted font-medium line-through',
				tag: '✓ DONE',
				meta: `${a.task!.category.toUpperCase()} · ${mins} MIN`,
				time: 'text-muted'
			};
		if (a.confirm)
			return {
				box: 'border-amber text-ink font-semibold',
				tag: 'DONE?',
				meta: 'TIME UP · CONFIRM ON THE NOW CARD',
				time: 'text-amber'
			};
		if (a.history)
			return {
				box: 'border-line text-faint',
				tag: 'WORKED',
				meta: `${a.task!.category.toUpperCase()} · ${mins} MIN`,
				time: 'text-muted'
			};
		if (a === lead && a.state === 'now')
			return {
				box: 'bg-accent border-accent text-accent-ink font-extrabold',
				tag: 'NOW',
				meta: `${a.task!.category.toUpperCase()} · ENDS ${minToHM(a.end)} · ${a.end - clock.minute} MIN LEFT`,
				time: 'text-accent-text'
			};
		if (a.pinned)
			return {
				box: 'border-ink text-ink font-semibold',
				tag: a.task?.start === 'asap' ? 'ASAP' : 'PINNED',
				meta: `${a.task!.category.toUpperCase()} · ${mins} MIN`,
				time: 'text-muted'
			};
		return {
			box: 'border-dashed border-line-3 text-ink-2 font-medium italic',
			tag: 'AUTO',
			meta: `${a.task!.category.toUpperCase()} · ${mins} MIN`,
			time: 'text-muted'
		};
	}

	function replan() {
		const n = (workspace.plan.byDate[today] ?? []).length;
		toast(`Re-planned · ${n} block${n === 1 ? '' : 's'} today · ${fmtHours(booked)} h booked`);
	}
</script>

<svelte:head><title>Paceline · Today</title></svelte:head>

<div
	class="flex flex-wrap justify-between gap-x-[18px] gap-y-2 border-b border-line px-4 py-[9px] font-mono text-[11px] tracking-[0.12em] text-muted uppercase nav:px-8"
>
	<div class="flex flex-wrap gap-3.5">
		<span class={lateCount ? 'text-amber' : 'text-accent-text'}
			>■ {lateCount ? 'Behind pace' : 'On pace'}</span
		>
		<span>Auto-fit {minToHM(clock.minute)}</span>
		{#if nextMeeting}<span>Next · {nextMeeting.title} {minToHM(nextMeeting.start)}</span>{/if}
		{#if lateCount}<span class="text-flare">■ {lateCount} forecast late</span>{/if}
	</div>
	<div>Doc. PL-0101 · Today</div>
</div>

<div class="flex flex-col gap-[26px] px-4 pt-6 pb-12 nav:px-8">
	<CaptureBar />

	<PageHead index="01" {eyebrow} title="{fmtLong(today)}.">
		{#snippet actions()}
			<Button size="lg" icon="undo" disabled={!workspace.canUndo} onclick={() => workspace.undo()}
				>Undo</Button
			>
			<Button size="lg" href="/week">Plan week</Button>
			<Button size="lg" variant="primary" iconRight="arrowRight" onclick={replan}>Plan today</Button
			>
		{/snippet}
	</PageHead>

	<KpiRow>
		<Kpi value={String(overdue).padStart(2, '0')} label="Overdue" tone={overdue ? 'late' : 'ink'} />
		<Kpi
			value={String(dueToday).padStart(2, '0')}
			label="Due today"
			tone={dueToday ? 'warn' : 'ink'}
		/>
		<Kpi value={fmtHours(booked)} unit="/{fmtHours(capacity)}h" label="Planned" />
		<Kpi value={focusToday} unit="min" label="Focus logged today" tone="lead" highlight />
	</KpiRow>

	<div class="flex flex-wrap items-start gap-6">
		<Panel
			title={agenda.length
				? `Schedule · ${minToHM(Math.min(...agenda.map((a) => a.start)))} → ${minToHM(Math.max(...agenda.map((a) => a.end)))}`
				: 'Schedule'}
			meta="Now {minToHM(clock.minute)}"
			metaClass="text-accent-text"
			class="flex-[1_1_420px]"
		>
			<div class="flex flex-col gap-1.5 px-[18px] py-3.5">
				{#each agenda as a (a.key)}
					{@const st = blockStyle(a)}
					<div class="grid grid-cols-[54px_minmax(0,1fr)] items-stretch gap-3">
						<span class="pt-[9px] font-mono text-xs {st.time}">{minToHM(a.start)}</span>
						<button
							type="button"
							disabled={a.kind === 'lunch'}
							onclick={() => (a.task ? openTask(a.task.id) : null)}
							class="flex flex-col justify-between gap-1 border px-3 py-[9px] text-left transition-opacity disabled:cursor-default {st.box} {a.kind ===
								'block' && a.state === 'past'
								? 'opacity-50'
								: ''}"
							style="min-height: {Math.max(40, Math.round((a.end - a.start) * 0.9))}px"
						>
							<span class="flex items-baseline justify-between gap-2.5">
								<span class="text-sm">{a.title}</span>
								<span
									class="flex-none font-mono text-[10px] tracking-[0.08em] not-italic opacity-85"
									>{st.tag}</span
								>
							</span>
							<span class="font-mono text-[10px] tracking-[0.06em] not-italic opacity-75"
								>{st.meta}</span
							>
						</button>
					</div>
				{:else}
					<p class="m-0 py-6 text-center text-sm text-muted">
						{pattern.kind === 'work'
							? 'Nothing planned yet. Capture a task above and the planner fits it in.'
							: 'No work blocks today.'}
					</p>
				{/each}
			</div>
		</Panel>

		<div class="flex min-w-0 flex-[1_1_380px] flex-col gap-6">
			<NowCard
				{lead}
				next={nextItem}
				{gap}
				calm={pattern.kind === 'uni'
					? 'University day · off-the-job'
					: pattern.kind === 'off'
						? 'Day off'
						: null}
			/>

			<Panel
				title="Must-dos 1–3"
				meta={musts.length ? (mustLeft ? `${mustLeft} left` : 'All done') : ''}
			>
				{#each musts as t, i (t.id)}
					{@const locked = i >= 3 && !firstThreeDone}
					{@const done = t.status === 'done'}
					{@const u = urgency(t, today)}
					<div
						class="grid min-h-[54px] w-full grid-cols-[30px_minmax(0,1fr)_auto_24px] items-center gap-3 border-b border-line px-[18px] py-3 {locked
							? 'bg-panel'
							: ''}"
					>
						<span
							class="text-lg heavy {locked
								? 'text-line-3'
								: done
									? 'text-faint'
									: i === musts.findIndex((x) => x.status !== 'done')
										? 'text-accent-text'
										: 'text-ink-3'}">{String(i + 1).padStart(2, '0')}</span
						>
						<button
							type="button"
							disabled={locked}
							onclick={() => openTask(t.id)}
							class="truncate text-left text-sm font-semibold disabled:cursor-not-allowed {locked
								? 'text-faint'
								: done
									? 'text-faint line-through'
									: 'text-ink hover:underline'}"
							>{locked ? 'Locked until 1–3 are done' : t.title}</button
						>
						{#if locked}
							<Badge fill tone="mute" label="If time" />
						{:else}
							<Badge fill tone={done ? 'lead' : u.tone} label={done ? 'Done' : u.label} />
						{/if}
						{#if locked}
							<span class="text-faint"><Icon name="lock" size={16} /></span>
						{:else}
							<Checkbox
								checked={done}
								label="Complete {t.title}"
								onchange={() => workspace.complete(t.id)}
							/>
						{/if}
					</div>
				{:else}
					<p class="m-0 px-[18px] py-6 text-sm text-muted">
						No must-dos. Capture something worth doing.
					</p>
				{/each}
				{#if musts.length > 3}
					<div
						class="px-[18px] py-2.5 font-mono text-[10px] tracking-[0.1em] uppercase {firstThreeDone
							? 'text-accent-text'
							: 'text-faint'}"
					>
						{firstThreeDone ? 'Must-dos cleared · 4–5 unlocked' : '4–5 unlock once 1–3 are done'}
					</div>
				{/if}
			</Panel>

			<Panel title="Quick wins · never auto-scheduled" meta="{quickOpenMin} min open">
				{#each quick as q (q.id)}
					{@const done = q.status === 'done'}
					<div
						class="grid min-h-12 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-[18px] py-[11px]"
					>
						<Checkbox
							checked={done}
							size={18}
							label="Complete {q.title}"
							onchange={() => workspace.complete(q.id)}
						/>
						<button
							type="button"
							onclick={() => openTask(q.id)}
							class="truncate text-left text-sm {done
								? 'text-muted line-through'
								: 'text-ink hover:underline'}">{q.title}</button
						>
						<span class="font-mono text-[11px] {done ? 'text-accent-text' : 'text-muted'}"
							>{done ? 'DONE · ' : ''}{q.estimateMin} MIN</span
						>
					</div>
				{:else}
					<p class="m-0 px-[18px] py-5 text-sm text-muted">
						Add one with <span class="font-mono text-ink-2">qw</span> at the start of a capture.
					</p>
				{/each}
			</Panel>

			<Panel title="Alerts">
				{#each workspace.alerts.slice(0, 5) as a, i (i)}
					<button
						type="button"
						class="flex w-full items-center justify-between gap-3 border-b border-line px-[18px] py-3 text-left text-sm hover:bg-hover"
						onclick={() => (a.taskId ? openTask(a.taskId) : a.view && goto(a.view))}
					>
						<span class="flex min-w-0 items-center gap-2.5">
							<span
								class="size-1.5 flex-none {a.tone === 'late'
									? 'bg-flare'
									: a.tone === 'warn'
										? 'bg-amber'
										: 'bg-ice'}"
							></span>
							<span class="truncate">{a.label === 'Overdue' ? `Overdue: “${a.text}”` : a.text}</span
							>
						</span>
						<span
							class="font-mono text-[11px] {a.tone === 'late'
								? 'text-flare'
								: a.tone === 'warn'
									? 'text-amber'
									: 'text-ice'}">{a.label.toUpperCase()}</span
						>
					</button>
				{:else}
					<div class="flex items-center justify-between px-[18px] py-3 text-sm text-muted">
						<span class="flex items-center gap-2.5"
							><span class="size-1.5 border border-muted"></span>Nothing needs you right now</span
						>
						<span class="font-mono">CLEAR</span>
					</div>
				{/each}
			</Panel>
		</div>
	</div>
</div>
