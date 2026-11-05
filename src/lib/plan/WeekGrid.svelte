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
	import { labelBar } from '../ui/styles.ts';
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
			if (p.kind === 'work' || p.kind === 'personal') {
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
			clock.today,
			workspace.awaiting
		).filter((a) => a.end > range[0] && a.start < range[1]);
	}

	const live = (a: AgendaItem) => !a.history && a.state !== 'past';

	function style(a: AgendaItem, d: ISODate): string {
		if (a.kind === 'meeting') return 'bg-ice text-signal-ink font-bold';
		if (a.kind === 'lunch') return 'bg-surface text-muted';
		if (a.done) return 'border border-line bg-canvas text-muted line-through';
		if (a.confirm) return 'border border-amber bg-canvas text-ink font-semibold';
		if (live(a) && workspace.waitsOn(a.task).length)
			return 'border border-flare bg-flare/12 text-flare font-semibold';
		if (d === clock.today && a.state === 'now') return 'bg-accent text-accent-ink font-extrabold';
		if (a.state === 'past') return 'border border-line bg-canvas text-faint';
		if (a.confirmed || a.fixed) return 'border-2 border-ink bg-raised text-ink font-semibold';
		if (a.pinned) return 'border border-ink bg-canvas text-ink font-semibold';
		if (a.quick) return 'border border-dotted border-ink-3 bg-canvas text-ink-2 hover:border-ink';
		return 'border border-dashed border-line-3 bg-canvas text-ink-2 italic hover:border-ink-3';
	}

	function tag(a: AgendaItem, d: ISODate): string {
		if (a.kind === 'meeting') return `${a.start ? minToHM(a.start) : ''}–${minToHM(a.end)}`;
		if (a.kind === 'lunch') return '';
		if (a.done) return `✓ DONE · ${minToHM(a.start)}–${minToHM(a.end)}`;
		if (a.confirm) return 'DID YOU COMPLETE THIS?';
		if (a.history) return `WORKED · ${minToHM(a.start)}–${minToHM(a.end)}`;
		const waits = workspace.waitsOn(a.task);
		if (waits.length) return `BLOCKED · WAITS ON ${waits.map((w) => w.ref).join(', ')}`;
		if (d === clock.today && a.state === 'now') return `NOW · ${a.end - clock.minute} MIN LEFT`;
		const kind = a.fixed
			? 'MOVED'
			: a.confirmed
				? 'CONFIRMED'
				: a.pinned
					? 'PINNED'
					: a.quick
						? 'QUICK WIN'
						: 'AUTO';
		return `${kind} · ${a.task!.category.toUpperCase()} · ${minToHM(a.start)}–${minToHM(a.end)}`;
	}

	// ── Drag a block to a new day and time ────────────────────
	const SNAP = 15;
	let drag = $state<{ id: string; grab: number; len: number } | null>(null);
	let ghost = $state<{ d: ISODate; start: number } | null>(null);

	const draggable = (a: AgendaItem) =>
		a.kind === 'block' && !a.history && !!a.task && a.task.status !== 'done';

	function dragStart(e: DragEvent, a: AgendaItem) {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		drag = { id: a.task!.id, grab: (e.clientY - box.top) / PX, len: a.end - a.start };
		e.dataTransfer?.setData('text/plain', a.task!.id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dropAt(e: DragEvent): number {
		const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const m = range[0] + (e.clientY - col.top) / PX - (drag?.grab ?? 0);
		return Math.max(range[0], Math.round(m / SNAP) * SNAP);
	}

	function over(e: DragEvent, d: ISODate) {
		if (!drag || d < clock.today) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		const start = dropAt(e);
		if (ghost?.d !== d || ghost.start !== start) ghost = { d, start };
	}

	function drop(e: DragEvent, d: ISODate) {
		if (!drag || d < clock.today) return;
		e.preventDefault();
		workspace.moveTo(drag.id, d, dropAt(e));
		drag = null;
		ghost = null;
	}

	function togglePin(a: AgendaItem, d: ISODate) {
		const t = a.task;
		if (!t || a.history) return;
		if (workspace.isLocked(t)) {
			workspace.unfix(t.id);
		} else if (t.start === 'date') {
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
		const label = `${DOW_SHORT[dow(d)].toUpperCase()}${isToday ? ' · TODAY' : p.kind === 'personal' ? ' · PERSONAL' : p.kind === 'uni' ? ' · UNIVERSITY' : s.leave.includes(d) ? ' · LEAVE' : p.kind === 'off' ? ' · OFF' : p.kind === 'work' && hmToMin(p.end) - hmToMin(p.start) < 360 ? ' · HALF' : ''}`;
		const meta =
			p.kind === 'personal'
				? `${fmtHours(booked)} H PERSONAL`
				: p.kind === 'uni' || p.kind === 'off'
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
						: h.p.kind === 'uni' || h.p.kind === 'personal'
							? 'text-lilac'
							: 'text-muted'}">{h.label}</span
				>
				<span
					class="text-xl font-extrabold wide {h.p.kind === 'uni' || h.p.kind === 'off'
						? 'text-muted'
						: ''}">{parseISO(d).getDate()}</span
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
				role="list"
				aria-label="{DOW_SHORT[dow(d)]} {parseISO(d).getDate()}"
				class="relative {i < days.length - 1 ? 'border-r border-line' : ''} {h.isToday
					? 'bg-panel'
					: ''} {h.p.kind === 'uni' || (h.p.kind === 'off' && !items.length) ? 'hatch' : ''}"
				style="height: {height}px"
				ondragover={(e) => over(e, d)}
				ondragleave={(e) => {
					if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) ghost = null;
				}}
				ondrop={(e) => drop(e, d)}
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
				{:else if h.p.kind === 'uni' || (h.p.kind === 'off' && !items.length)}
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
							>{h.p.kind === 'uni' ? 'No tasks scheduled.' : 'Nothing scheduled.'}</span
						>
					</div>
				{/if}

				{#each items.filter((x) => x.kind === 'reserved') as r (r.key)}
					<div
						class="pointer-events-none absolute inset-x-0 border-y border-lilac/50 bg-lilac/10"
						style="top: {y(r.start)}px; height: {(r.end - r.start) * PX}px"
					>
						<span
							class="absolute right-1 bottom-0.5 font-mono text-[8.5px] tracking-[0.1em] text-lilac uppercase"
							>{r.title} · reserved</span
						>
					</div>
				{/each}

				{#each items.filter((x) => x.kind !== 'reserved') as a (a.key)}
					{@const top = y(Math.max(a.start, range[0]))}
					{@const hgt = Math.max(
						16,
						(Math.min(a.end, range[1]) - Math.max(a.start, range[0])) * PX - 1.5
					)}
					{@const labels = workspace.labelsOf(a.task)}
					<button
						type="button"
						disabled={a.kind === 'lunch'}
						draggable={draggable(a)}
						ondragstart={(e) => dragStart(e, a)}
						ondragend={() => ((drag = null), (ghost = null))}
						class="absolute inset-x-1 overflow-hidden py-1 pr-2 text-left text-xs leading-tight disabled:cursor-default {labels.length
							? 'pl-3'
							: 'pl-2'} {draggable(a) ? 'cursor-grab active:cursor-grabbing' : ''} {drag &&
						drag.id === a.task?.id
							? 'opacity-40'
							: ''} {style(a, d)}"
						style="top: {top}px; height: {hgt}px; {hgt < 22
							? 'padding-top: 1px; font-size: 11px'
							: ''}"
						title="{a.title} · {minToHM(a.start)}–{minToHM(a.end)}{labels.length
							? ` · ${labels.map((l) => l.name).join(', ')}`
							: ''}{draggable(a) ? ' · drag to move' : ''}"
						onclick={() =>
							a.task ? openTask(a.task.id) : a.meeting ? ui.openMeeting(a.meeting) : null}
						ondblclick={() => togglePin(a, d)}
					>
						{#if labels.length}
							<span class="absolute inset-y-0 left-0 flex w-1.5 flex-col" aria-hidden="true">
								{#each labels as l (l.id)}<span class="flex-1 {labelBar[l.color]}"></span>{/each}
							</span>
						{/if}
						<span class="block truncate">{a.title}</span>
						{#if hgt >= 36 && a.kind !== 'lunch'}
							<span
								class="block truncate font-mono text-[9px] tracking-[0.06em] not-italic opacity-80"
								>{tag(a, d)}</span
							>
						{/if}
						{#if hgt >= 50 && labels.length}
							<span class="mt-0.5 flex flex-wrap gap-1 not-italic">
								{#each labels as l (l.id)}
									<span
										class="inline-flex items-center gap-1 bg-canvas/80 px-1 font-mono text-[8.5px] font-semibold tracking-[0.06em] text-ink uppercase"
										><span class="size-1.5 {labelBar[l.color]}"></span>{l.name}</span
									>
								{/each}
							</span>
						{/if}
					</button>
				{/each}

				{#if ghost?.d === d && drag}
					<div
						class="pointer-events-none absolute inset-x-1 z-10 border-2 border-dashed border-ink bg-ink/10"
						style="top: {y(ghost.start)}px; height: {Math.max(16, drag.len * PX)}px"
					>
						<span class="absolute -top-4 left-0 bg-ink px-1 font-mono text-[9.5px] text-canvas"
							>{minToHM(ghost.start)}</span
						>
					</div>
				{/if}

				{#if h.isToday && clock.minute >= range[0] && clock.minute <= range[1]}
					<div
						class="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-ink"
						style="top: {y(clock.minute)}px"
					></div>
					<span
						class="pointer-events-none absolute -left-1 z-20 size-2.5 rounded-full border-2 border-canvas bg-ink"
						style="top: {y(clock.minute) - 4}px"
					></span>
				{/if}
			</div>
		{/each}
	</div>
</div>
