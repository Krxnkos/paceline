<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { code, quadrantOf, urgency } from '#lib/domain/forecast.ts';
	import { fmtDur } from '#lib/domain/dates.ts';
	import { catSwatch } from '#lib/ui/categories.ts';
	import { pointerDrag } from '#lib/ui/pointerDrag.ts';
	import type { Quadrant, Task } from '#lib/types.ts';

	const urgentDays = $derived(workspace.settings.urgentDays ?? 2);

	const QUADS: {
		id: Quadrant;
		title: string;
		sub: string;
		hint: string;
		tone: string;
	}[] = [
		{
			id: 'do',
			title: 'Do first',
			sub: 'Urgent · important',
			hint: 'Planned ahead of everything else',
			tone: 'border-accent-text text-accent-text'
		},
		{
			id: 'schedule',
			title: 'Schedule',
			sub: 'Important · not urgent',
			hint: 'Planned as normal: protect time for these',
			tone: 'border-ice text-ice'
		},
		{
			id: 'delegate',
			title: 'Delegate',
			sub: 'Urgent · not important',
			hint: 'Drop one here to park it as waiting',
			tone: 'border-amber text-amber'
		},
		{
			id: 'drop',
			title: 'Eliminate',
			sub: 'Neither',
			hint: 'Drop one here to park it as someday',
			tone: 'border-line-3 text-muted'
		}
	];

	const open = $derived(
		workspace.tasks
			.filter((t) => t.status !== 'done' && !t.inbox)
			.sort((a, b) => a.priority - b.priority)
	);
	const byQuad = $derived(
		Object.fromEntries(
			QUADS.map((q) => [q.id, open.filter((t) => quadrantOf(t, clock.today, urgentDays) === q.id)])
		) as Record<Quadrant, Task[]>
	);

	// ── Drag a card into another quadrant ─────────────────────
	let drag = $state<{
		id: string;
		title: string;
		x: number;
		y: number;
		over: Quadrant | null;
	} | null>(null);
	const zones: Partial<Record<Quadrant, HTMLElement>> = {};

	function zoneAt(x: number, y: number): Quadrant | null {
		for (const q of QUADS) {
			const r = zones[q.id]?.getBoundingClientRect();
			if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return q.id;
		}
		return null;
	}

	function dragFor(t: Task) {
		return {
			enabled: true,
			callbacks: {
				start: (e: PointerEvent) => {
					drag = { id: t.id, title: t.title, x: e.clientX, y: e.clientY, over: null };
				},
				move: (e: PointerEvent) => {
					if (drag)
						drag = { ...drag, x: e.clientX, y: e.clientY, over: zoneAt(e.clientX, e.clientY) };
				},
				end: (_e: PointerEvent | null, cancelled: boolean) => {
					const d = drag;
					drag = null;
					if (!d || cancelled || !d.over) return;
					const task = workspace.task(d.id);
					if (task && quadrantOf(task, clock.today, urgentDays) !== d.over)
						workspace.setQuadrant(d.id, d.over);
				}
			}
		};
	}
</script>

<svelte:head><title>Paceline · Matrix</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-10 nav:px-8">
	<PageHead
		index="13"
		eyebrow="Eisenhower Matrix · urgent means due within {urgentDays} day{urgentDays === 1
			? ''
			: 's'}"
		title="What matters,"
		accent="and what can wait."
	/>
	<p class="m-0 max-w-[720px] text-[14px] leading-relaxed text-ink-3">
		Tasks sort themselves by priority (1–2 is important) and due date. Drag a card to another square
		to decide for yourself: <strong class="text-ink-2">Do first</strong> jumps the plan,
		<strong class="text-ink-2">Delegate</strong> and <strong class="text-ink-2">Eliminate</strong>
		take it off the calendar until you bring it back.
	</p>

	<div class="grid gap-4 md:grid-cols-2">
		{#each QUADS as q (q.id)}
			{@const list = byQuad[q.id]}
			<section
				bind:this={zones[q.id]}
				aria-label={q.title}
				class="flex min-h-[220px] flex-col border transition-[background-color,border-color,transform] duration-200 {drag?.over ===
				q.id
					? 'scale-[1.01] border-ink bg-hover'
					: 'border-line'}"
			>
				<header class="flex items-baseline justify-between gap-3 border-b-2 px-4 py-3 {q.tone}">
					<span class="flex items-baseline gap-2.5">
						<span class="text-[19px] heavy">{q.title}</span>
						<span class="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">{q.sub}</span
						>
					</span>
					<span class="font-mono text-xs">{String(list.length).padStart(2, '0')}</span>
				</header>
				<div class="flex flex-1 flex-col gap-1.5 p-2.5">
					{#each list as t (t.id)}
						{@const u = urgency(t, clock.today)}
						<button
							type="button"
							use:pointerDrag={dragFor(t)}
							animate:flip={{ duration: 260, easing: cubicOut }}
							in:fly={{ y: 8, duration: 200 }}
							onclick={() => openTask(t.id)}
							class="flex cursor-grab items-center gap-3 border border-line-2 bg-surface px-3 py-2 text-left transition-[opacity,box-shadow] select-none hover:border-ink-3 {drag?.id ===
							t.id
								? 'opacity-30'
								: ''}"
						>
							<span class="size-2 flex-none {catSwatch(t.category)}"></span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[13.5px] font-semibold">{t.title}</span>
								<span class="font-mono text-[10px] tracking-[0.06em] text-muted uppercase"
									>{code(t.code)} · P{t.priority} · {fmtDur(t.estimateMin)}{t.waiting
										? ` · waiting for ${t.waiting}`
										: t.someday
											? ' · someday'
											: ''}{t.quadrant ? ' · set by you' : ''}</span
								>
							</span>
							{#if t.due}<Badge tone={u.tone} label={u.label} />{/if}
						</button>
					{:else}
						<p class="m-auto p-6 text-center text-[13px] text-faint">{q.hint}</p>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if drag}
	<div
		class="shadow-2xl pointer-events-none fixed z-[95] max-w-[280px] -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-raised px-3 py-2 text-[13px] font-semibold"
		style="left: {drag.x}px; top: {drag.y}px"
		transition:fade={{ duration: 120 }}
	>
		<span class="block truncate">{drag.title}</span>
		<span class="font-mono text-[10px] text-muted uppercase"
			>{drag.over ? `→ ${QUADS.find((q) => q.id === drag!.over)?.title}` : 'Drop in a square'}</span
		>
	</div>
{/if}
