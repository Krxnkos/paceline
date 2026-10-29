<script lang="ts">
	import Button from '../ui/Button.svelte';
	import { focus, fmtClock } from '../stores/focus.svelte.ts';
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { fmtDur, minToHM, fmtShort } from '../domain/dates.ts';
	import { code, urgency } from '../domain/forecast.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import type { AgendaItem } from './agenda.ts';
	import type { Task } from '../types.ts';
	import { panelHead } from '../ui/styles.ts';

	let {
		lead,
		next,
		gap,
		calm
	}: {
		lead: AgendaItem | null;
		next: AgendaItem | null;
		gap: { start: number; fits: Task | null } | null;
		calm: string | null;
	} = $props();

	const task = $derived(lead?.task ?? null);
	const mine = $derived(!!task && focus.state?.taskId === task.id);
	const total = $derived(
		mine && focus.state ? focus.state.total : (workspace.settings.focusMin ?? 25) * 60
	);
	const remain = $derived(mine ? focus.remaining : total);
	const r = 48;
	const circ = 2 * Math.PI * r;
	const frac = $derived(total ? remain / total : 1);
	const phase = $derived(
		mine && focus.state
			? focus.state.phase === 'break'
				? 'BREAK'
				: focus.state.paused
					? 'PAUSED'
					: 'FOCUS · RUNNING'
			: lead?.state === 'now'
				? `${minToHM(lead.start)}–${minToHM(lead.end)}`
				: lead
					? `UP NEXT · ${minToHM(lead.start)}`
					: 'NOTHING PLANNED'
	);

	function toggle() {
		if (!task) return;
		if (mine) focus.toggle();
		else focus.start(task.id);
	}
</script>

<section aria-label="Now" class="border border-line bg-surface">
	<div class={panelHead}>
		<span>Now · lead block</span><span class={mine && focus.running ? 'text-accent-text' : ''}
			>{phase}</span
		>
	</div>

	{#if task && lead}
		<div class="flex flex-wrap items-center gap-5 p-[18px]">
			<button
				type="button"
				class="flex-none"
				onclick={() => mine && (ui.focusOpen = true)}
				aria-label="Pomodoro {fmtClock(remain)} remaining{mine ? ', open focus' : ''}"
			>
				<svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
					<circle cx="56" cy="56" {r} fill="none" stroke="var(--line-2)" stroke-width="6"></circle>
					<circle
						cx="56"
						cy="56"
						{r}
						fill="none"
						stroke={focus.state?.phase === 'break' && mine ? 'var(--ice)' : 'var(--accent)'}
						stroke-width="6"
						stroke-dasharray="{circ * frac} {circ}"
						transform="rotate(-90 56 56)"
						class="transition-[stroke-dasharray] duration-300"
					></circle>
					<text
						x="56"
						y="62"
						text-anchor="middle"
						fill="var(--ink)"
						font-family="JetBrains Mono, monospace"
						font-size="19"
						font-weight="700">{fmtClock(remain)}</text
					>
				</svg>
			</button>
			<div class="flex min-w-[180px] flex-1 flex-col gap-2">
				<button
					type="button"
					class="text-left text-lg leading-tight font-bold hover:underline"
					onclick={() => openTask(task.id)}>{task.title}</button
				>
				<span class="font-mono text-[11px] text-muted uppercase">
					{code(task.code)} · {fmtDur(task.loggedMin)} of {fmtDur(task.estimateMin)} tracked{task.due
						? ` · due ${fmtShort(task.due).slice(0, 3)}`
						: ''}
					{#if task.due}<span class="sr-only">{urgency(task, clock.today).label}</span>{/if}
				</span>
				<div class="mt-1 flex flex-wrap gap-2">
					<Button
						variant={mine && focus.running ? 'secondary' : 'primary'}
						size="md"
						icon={mine && focus.running ? 'pause' : 'play'}
						onclick={toggle}
						>{mine
							? focus.running
								? 'Pause'
								: 'Resume'
							: `Start focus · ${workspace.settings.focusMin}m`}</Button
					>
					{#if mine}
						<Button size="md" onclick={() => focus.endAndLog()}>End & log</Button>
					{/if}
					<Button size="md" icon="check" onclick={() => workspace.complete(task.id)}
						>Complete</Button
					>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-2 p-[18px]">
			<span class="eyebrow text-lilac">{calm ?? 'Clear'}</span>
			<span class="text-[15px] text-ink-2">Nothing scheduled right now.</span>
			{#if next}<span class="text-[13px] text-muted"
					>Next block: {next.title} at {minToHM(next.start)}</span
				>{/if}
		</div>
	{/if}

	<div class="grid grid-cols-2 border-t border-line">
		<div class="flex flex-col gap-1 border-r border-line px-[18px] py-3">
			<span class="eyebrow text-[10px]">Next</span>
			<span class="truncate text-[13px]"
				>{next ? `${next.title} · ${minToHM(next.start)}` : 'Nothing else today'}</span
			>
		</div>
		<div class="flex flex-col gap-1 px-[18px] py-3">
			<span class="eyebrow text-[10px]">{gap ? `Free gap ${minToHM(gap.start)}` : 'Free gap'}</span>
			<span class="truncate text-[13px]"
				>{gap ? (gap.fits ? `Fits: ${gap.fits.title}` : 'Room to breathe') : 'Day is full'}</span
			>
		</div>
	</div>
</section>
