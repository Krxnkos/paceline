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
		awayLabel,
		patternFor
	} from '../domain/dates.ts';
	import { bookedMin, dayCapacity } from '../domain/plan.ts';
	import { labelBar } from '../ui/styles.ts';
	import { pointerDrag } from '../ui/pointerDrag.ts';
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
	// The block follows the pointer, snaps to 15 minutes, and lands exactly where
	// the preview shows. Escape cancels.
	const SNAP = 15;
	let drag = $state<{
		id: string;
		title: string;
		len: number;
		grab: number;
		d: ISODate;
		start: number;
		ok: boolean;
	} | null>(null);
	let cols: HTMLElement[] = $state([]);
	let scroller: HTMLElement | undefined = $state();

	const draggable = (a: AgendaItem) =>
		a.kind === 'block' && !a.history && !!a.task && a.task.status !== 'done';

	function place(x: number, yPx: number) {
		if (!drag) return;
		let i = cols.findIndex((c) => {
			const r = c.getBoundingClientRect();
			return x >= r.left && x < r.right;
		});
		if (i < 0) {
			const first = cols[0]?.getBoundingClientRect();
			i = first && x < first.left ? 0 : cols.length - 1;
		}
		const col = cols[i]?.getBoundingClientRect();
		if (!col) return;
		const d = days[i];
		const raw = range[0] + (yPx - col.top) / PX - drag.grab;
		let start = Math.round(raw / SNAP) * SNAP;
		start = Math.max(range[0], Math.min(start, range[1] - Math.min(drag.len, 60)));
		if (d === clock.today) start = Math.max(start, Math.ceil(clock.minute / SNAP) * SNAP);
		const ok = d >= clock.today;
		if (drag.d !== d || drag.start !== start || drag.ok !== ok) drag = { ...drag, d, start, ok };
	}

	function dragFor(a: AgendaItem, d: ISODate) {
		return {
			enabled: draggable(a),
			scroll: () => [scroller],
			callbacks: {
				start: (e: PointerEvent, origin: { x: number; y: number }, node: HTMLElement) => {
					const box = node.getBoundingClientRect();
					drag = {
						id: a.task!.id,
						title: a.title,
						len: a.end - a.start,
						grab: (origin.y - box.top) / PX,
						d,
						start: a.start,
						ok: true
					};
					place(e.clientX, e.clientY);
				},
				move: (e: PointerEvent) => place(e.clientX, e.clientY),
				end: (_e: PointerEvent | null, cancelled: boolean) => {
					const g = drag;
					drag = null;
					if (!g || cancelled || !g.ok) return;
					workspace.moveTo(g.id, g.d, g.start);
				}
			}
		};
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
		const label = `${DOW_SHORT[dow(d)].toUpperCase()}${isToday ? ' · TODAY' : p.kind === 'personal' ? ' · PERSONAL' : p.kind === 'uni' ? ` · ${awayLabel(p).toUpperCase()}` : s.leave.includes(d) ? ' · LEAVE' : p.kind === 'off' ? ' · OFF' : p.kind === 'work' && hmToMin(p.end) - hmToMin(p.start) < 360 ? ' · HALF' : ''}`;
		const meta =
			p.kind === 'personal'
				? `${fmtHours(booked)} H PERSONAL`
				: p.kind === 'uni' || p.kind === 'off'
					? '—'
					: `${fmtHours(booked)} / ${fmtHours(cap)} H${cap && booked >= cap ? ' · FULL' : ''}`;
		return { p, label, meta, full: cap > 0 && booked >= cap, isToday };
	}
</script>

<div class="min-w-0 overflow-x-auto border border-line" bind:this={scroller}>
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
				bind:this={cols[i]}
				role="list"
				aria-label="{DOW_SHORT[dow(d)]} {parseISO(d).getDate()}"
				class="relative {i < days.length - 1 ? 'border-r border-line' : ''} {h.isToday
					? 'bg-panel'
					: ''} {h.p.kind === 'uni' || (h.p.kind === 'off' && !items.length) ? 'hatch' : ''}"
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
				{:else if h.p.kind === 'uni' || (h.p.kind === 'off' && !items.length)}
					<div class="absolute inset-x-3 top-[35%] flex flex-col items-start gap-1.5">
						<span
							class="bg-canvas px-1.5 py-1 font-mono text-[10px] tracking-[0.14em] {h.p.kind ===
							'uni'
								? 'text-lilac'
								: 'text-muted'}"
							>{h.p.kind === 'uni'
								? awayLabel(h.p).toUpperCase()
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
						use:pointerDrag={dragFor(a, d)}
						class="pl-block absolute inset-x-1 overflow-hidden py-1 pr-2 text-left text-xs leading-tight select-none disabled:cursor-default {labels.length
							? 'pl-3'
							: 'pl-2'} {draggable(a) ? 'cursor-grab' : ''} {drag && drag.id === a.task?.id
							? 'opacity-30'
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

				{#if drag && drag.d === d}
					<div
						class="pl-ghost shadow-xl pointer-events-none absolute inset-x-1 z-30 flex flex-col justify-between overflow-hidden px-2 py-1 text-xs leading-tight font-semibold {drag.ok
							? 'border-2 border-ink bg-raised text-ink'
							: 'border-2 border-dashed border-flare bg-flare/15 text-flare'}"
						style="top: {y(drag.start)}px; height: {Math.max(18, drag.len * PX)}px"
					>
						<span class="truncate">{drag.title}</span>
						<span class="font-mono text-[10px] tracking-[0.06em] {drag.ok ? 'text-ink-2' : ''}"
							>{drag.ok
								? `${DOW_SHORT[dow(d)]} ${minToHM(drag.start)}–${minToHM(drag.start + drag.len)}`
								: 'Can’t move into the past'}</span
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
