<script lang="ts">
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { agendaFor, type AgendaItem } from '../task/agenda.ts';
	import {
		DOW_SHORT,
		dow,
		fmtHours,
		hmToMin,
		minToHM,
		parseISO,
		patternFor
	} from '../domain/dates.ts';
	import { bookedMin, dayCapacity } from '../domain/plan.ts';
	import type { ISODate } from '../types.ts';

	let { days }: { days: ISODate[] } = $props();

	const PX = 1.3; // px per minute: 78px an hour
	const s = $derived(workspace.settings);

	// Grid spans the earliest start to the latest end across the week, at least 07:30–17:00.
	const range = $derived.by(() => {
		let a = 7 * 60 + 30;
		let b = 17 * 60;
		for (const d of days) {
			const p = patternFor(s, d);
			if (p.kind === 'work') {
				a = Math.min(a, hmToMin(p.start) - 15);
				b = Math.max(b, hmToMin(p.end) + 15);
			}
			for (const m of workspace.meetings)
				if (m.date === d) {
					a = Math.min(a, hmToMin(m.start));
					b = Math.max(b, hmToMin(m.end));
				}
		}
		return [Math.floor(a / 30) * 30, Math.ceil(b / 30) * 30] as const;
	});
	const height = $derived((range[1] - range[0]) * PX);
	const hours = $derived(
		Array.from(
			{ length: Math.floor((range[1] - range[0]) / 60) + 1 },
			(_, i) => Math.ceil(range[0] / 60) * 60 + i * 60
		).filter((m) => m < range[1])
	);
	const y = (min: number) => (min - range[0]) * PX;

	function itemsFor(d: ISODate) {
		return agendaFor(
			d,
			workspace.plan,
			workspace.tasks,
			workspace.meetings,
			s,
			clock.minute,
			clock.today
		).filter((a) => a.end > range[0] && a.start < range[1]);
	}

	function style(a: AgendaItem, d: ISODate): string {
		if (a.kind === 'meeting') return 'bg-ice text-signal-ink font-bold';
		if (a.kind === 'lunch') return 'bg-surface text-muted';
		if (d === clock.today && a.state === 'now') return 'bg-accent text-accent-ink font-extrabold';
		if (a.state === 'past') return 'border border-line text-faint';
		if (a.pinned) return 'border border-ink text-ink font-semibold';
		return 'border border-dashed border-line-3 text-ink-2 italic hover:border-ink-3';
	}

	function tag(a: AgendaItem, d: ISODate): string {
		if (a.kind === 'meeting') return `${a.start ? minToHM(a.start) : ''}–${minToHM(a.end)}`;
		if (a.kind === 'lunch') return '';
		if (d === clock.today && a.state === 'now') return `NOW · ${a.end - clock.minute} MIN LEFT`;
		return `${a.pinned ? 'PINNED' : 'AUTO'} · ${a.task!.category.toUpperCase()} · ${minToHM(a.start)}–${minToHM(a.end)}`;
	}

	function togglePin(a: AgendaItem, d: ISODate) {
		const t = a.task;
		if (!t) return;
		if (t.start === 'date') {
			workspace.updateTask(t.id, { start: 'auto', startDate: null });
			toast('Handed back to the planner');
		} else {
			workspace.updateTask(t.id, { start: 'date', startDate: d });
			toast(`Pinned to ${DOW_SHORT[dow(d)]} · won’t move earlier`);
		}
	}

	function header(d: ISODate) {
		const p = patternFor(s, d);
		const cap = dayCapacity(s, workspace.meetings, d);
		const booked = bookedMin(workspace.plan, d);
		const isToday = d === clock.today;
		const label = `${DOW_SHORT[dow(d)].toUpperCase()}${isToday ? ' · TODAY' : p.kind === 'uni' ? ' · UNIVERSITY' : s.leave.includes(d) ? ' · LEAVE' : p.kind === 'off' ? ' · OFF' : p.kind === 'work' && hmToMin(p.end) - hmToMin(p.start) < 360 ? ' · HALF' : ''}`;
		const meta =
			p.kind === 'uni'
				? `OTJ ${p.otjHours} H`
				: p.kind === 'off'
					? '—'
					: `${fmtHours(booked)} / ${fmtHours(cap)} H${cap && booked >= cap ? ' · FULL' : ''}`;
		return { p, label, meta, full: cap > 0 && booked >= cap, isToday };
	}
</script>

<div class="min-w-0 overflow-x-auto border border-line">
	<div
		class="grid min-w-[860px]"
		style="grid-template-columns: 56px repeat({days.length}, minmax(0, 1fr))"
	>
		<div class="border-r border-b border-line"></div>
		{#each days as d, i (d)}
			{@const h = header(d)}
			<div
				class="flex flex-col gap-[3px] border-line p-3 {i < days.length - 1
					? 'border-r'
					: ''} {h.isToday ? 'border-b-2 border-b-accent bg-surface' : 'border-b'}"
			>
				<span
					class="font-mono text-[10px] tracking-[0.14em] {h.isToday
						? 'text-accent-text'
						: h.p.kind === 'uni'
							? 'text-lilac'
							: 'text-muted'}">{h.label}</span
				>
				<span class="text-xl font-extrabold wide {h.p.kind !== 'work' ? 'text-muted' : ''}"
					>{parseISO(d).getDate()}</span
				>
				<span class="font-mono text-[10px] {h.full ? 'text-amber' : 'text-muted'}">{h.meta}</span>
			</div>
		{/each}

		<div
			class="relative border-r border-line font-mono text-[10px] text-faint"
			style="height: {height}px"
		>
			{#each hours as m (m)}
				<span class="absolute right-2" style="top: {Math.max(0, y(m) - 6)}px">{minToHM(m)}</span>
			{/each}
		</div>

		{#each days as d, i (d)}
			{@const h = header(d)}
			{@const items = itemsFor(d)}
			<div
				class="relative {i < days.length - 1 ? 'border-r border-line' : ''} {h.isToday
					? 'bg-panel'
					: ''} {h.p.kind !== 'work' ? 'hatch' : ''}"
				style="height: {height}px"
			>
				{#each hours as m (m)}
					<div
						class="pointer-events-none absolute inset-x-0 border-t border-line/50"
						style="top: {y(m)}px"
					></div>
				{/each}
				{#if h.p.kind === 'work'}
					<div
						class="absolute inset-x-0 top-0 hatch-fine"
						style="height: {y(hmToMin(h.p.start))}px"
					></div>
					<div
						class="absolute inset-x-0 bottom-0 hatch-fine"
						style="top: {y(hmToMin(h.p.end))}px"
					></div>
					{#if d < clock.today}
						<div class="absolute inset-0 bg-canvas/30"></div>
					{/if}
				{:else}
					<div class="absolute inset-x-3 top-[35%] flex flex-col items-start gap-1.5">
						<span
							class="bg-canvas px-1.5 py-1 font-mono text-[10px] tracking-[0.14em] {h.p.kind ===
							'uni'
								? 'text-lilac'
								: 'text-muted'}"
							>{h.p.kind === 'uni'
								? 'UNIVERSITY'
								: s.leave.includes(d)
									? 'LEAVE'
									: 'NOT A WORK DAY'}</span
						>
						<span class="bg-canvas px-1.5 py-1 text-[13px] text-ink-3"
							>{h.p.kind === 'uni'
								? 'No tasks scheduled. Counts towards off-the-job hours.'
								: 'Nothing scheduled.'}</span
						>
					</div>
				{/if}

				{#each items as a (a.key)}
					{@const top = y(Math.max(a.start, range[0]))}
					{@const hgt = Math.max(
						16,
						(Math.min(a.end, range[1]) - Math.max(a.start, range[0])) * PX - 1.5
					)}
					<button
						type="button"
						disabled={a.kind === 'lunch'}
						class="absolute inset-x-1 overflow-hidden px-2 py-1 text-left text-xs leading-tight disabled:cursor-default {style(
							a,
							d
						)}"
						style="top: {top}px; height: {hgt}px; {hgt < 22
							? 'padding-top: 1px; font-size: 11px'
							: ''}"
						title="{a.title} · {minToHM(a.start)}–{minToHM(a.end)}"
						onclick={() =>
							a.task ? openTask(a.task.id) : a.meeting ? ui.openMeeting(a.meeting) : null}
						ondblclick={() => togglePin(a, d)}
					>
						<span class="block truncate">{a.title}</span>
						{#if hgt >= 36 && a.kind !== 'lunch'}
							<span
								class="block truncate font-mono text-[9px] tracking-[0.06em] not-italic opacity-80"
								>{tag(a, d)}</span
							>
						{/if}
					</button>
				{/each}

				{#if h.isToday && clock.minute >= range[0] && clock.minute <= range[1]}
					<div
						class="pointer-events-none absolute inset-x-0 h-0.5 bg-accent"
						style="top: {y(clock.minute)}px"
					></div>
					<span
						class="pointer-events-none absolute left-0 h-5 w-2 bg-accent"
						style="top: {y(clock.minute) - 9}px"
					></span>
				{/if}
			</div>
		{/each}
	</div>
</div>
