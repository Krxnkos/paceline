<script lang="ts">
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Panel from '../ui/Panel.svelte';
	import Badge from '../ui/Badge.svelte';
	import Button from '../ui/Button.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import Icon from '../ui/Icon.svelte';
	import Select from '../ui/Select.svelte';
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { code, frogOf, ivyList, oneThreeFive, urgency } from '../domain/forecast.ts';
	import { fmtDur, minToHM } from '../domain/dates.ts';
	import type { DailyMethod, Task } from '../types.ts';

	let { method }: { method: Exclude<DailyMethod, 'must3'> } = $props();

	const today = $derived(clock.today);
	const ivy = $derived(ivyList(workspace.tasks, workspace.plan, today, workspace.data?.daily));
	const ivyNext = $derived(ivy.find((t) => t.status !== 'done') ?? null);
	const sizes = $derived(oneThreeFive(workspace.tasks, workspace.plan, today));
	const frog = $derived(frogOf(workspace.tasks, workspace.plan, today));
	const frogAt = $derived(frog ? workspace.plan.placed[frog.id]?.blocks[0] : undefined);
	const afterFrog = $derived(
		ivyList(workspace.tasks, workspace.plan, today, null)
			.filter((t) => t.id !== frog?.id)
			.slice(0, 3)
	);
	const frogOptions = $derived([
		{ value: '', label: 'Pick a different frog…' },
		...workspace.tasks
			.filter((t) => t.status !== 'done' && !t.inbox && !t.quick && t.id !== frog?.id)
			.map((t) => ({ value: t.id, label: `${code(t.code)} · ${t.title}` }))
	]);
	let frogPick = $state('');

	function moveIvy(i: number, dir: -1 | 1) {
		const ids = ivy.map((t) => t.id);
		const j = i + dir;
		if (j < 0 || j >= ids.length) return;
		[ids[i], ids[j]] = [ids[j], ids[i]];
		workspace.setDaily(ids);
	}

	function startFocus(t: Task) {
		focus.start(t.id);
		ui.focusOpen = true;
	}
</script>

{#snippet row(t: Task, n: string, active = false, controls?: Snippet)}
	{@const done = t.status === 'done'}
	{@const u = urgency(t, today)}
	<div
		class="grid min-h-[52px] grid-cols-[30px_minmax(0,1fr)_auto_24px] items-center gap-3 border-b border-line px-[18px] py-2.5 transition-colors {active
			? 'bg-accent/8'
			: ''}"
	>
		<span class="text-lg heavy {done ? 'text-faint' : active ? 'text-accent-text' : 'text-ink-3'}"
			>{n}</span
		>
		<button
			type="button"
			onclick={() => openTask(t.id)}
			class="flex min-w-0 flex-col items-start text-left"
		>
			<span
				class="w-full truncate text-sm font-semibold {done
					? 'text-faint line-through'
					: 'text-ink hover:underline'}">{t.title}</span
			>
			<span class="font-mono text-[10px] tracking-[0.06em] text-muted uppercase"
				>{t.category} · {fmtDur(t.estimateMin)}</span
			>
		</button>
		<span class="flex items-center gap-1">
			{#if controls}{@render controls()}{:else}
				<Badge fill tone={done ? 'lead' : u.tone} label={done ? 'Done' : u.label} />
			{/if}
		</span>
		<Checkbox checked={done} label="Complete {t.title}" onchange={() => workspace.complete(t.id)} />
	</div>
{/snippet}

{#if method === 'ivy'}
	<Panel
		title="Ivy Lee · six, in order"
		meta={ivy.length ? `${ivy.filter((t) => t.status !== 'done').length} left` : ''}
	>
		{#each ivy as t, i (t.id)}
			<div animate:flip={{ duration: 240, easing: cubicOut }}>
				{#snippet arrows()}
					<button
						type="button"
						class="grid size-7 place-items-center text-muted hover:bg-hover hover:text-ink disabled:opacity-30"
						aria-label="Move {t.title} up"
						disabled={i === 0}
						onclick={() => moveIvy(i, -1)}><Icon name="chevronUp" size={14} /></button
					>
					<button
						type="button"
						class="grid size-7 place-items-center text-muted hover:bg-hover hover:text-ink disabled:opacity-30"
						aria-label="Move {t.title} down"
						disabled={i === ivy.length - 1}
						onclick={() => moveIvy(i, 1)}><Icon name="chevronDown" size={14} /></button
					>
				{/snippet}
				{@render row(t, String(i + 1).padStart(2, '0'), t === ivyNext, arrows)}
			</div>
		{:else}
			<p class="m-0 px-[18px] py-6 text-sm text-muted">Nothing to rank yet. Capture a few tasks.</p>
		{/each}
		<p class="m-0 px-[18px] py-2.5 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
			Work them strictly in order · the order you set is planned first
		</p>
	</Panel>
{:else if method === 'one35'}
	<Panel title="1-3-5 · today’s list" meta="1 big · 3 medium · 5 small">
		{#each [{ k: 'big', n: 1, label: 'One big thing', hint: '90 min or more' }, { k: 'medium', n: 3, label: 'Three medium', hint: '30–89 min' }, { k: 'small', n: 5, label: 'Five small', hint: 'under 30 min, quick wins count' }] as g (g.k)}
			{@const list = sizes[g.k as 'big' | 'medium' | 'small']}
			<div
				class="flex items-baseline justify-between border-b border-line bg-panel px-[18px] py-2 font-mono text-[10px] tracking-[0.12em] text-muted uppercase"
			>
				<span>{g.label}</span><span>{g.hint}</span>
			</div>
			{#each list as t, i (t.id)}
				<div in:fly={{ y: 6, duration: 180 }}>{@render row(t, String(i + 1))}</div>
			{/each}
			{#each Array.from({ length: Math.max(0, g.n - list.length) }, (_v, i) => i) as i (i)}
				<div
					class="mx-[18px] my-2 border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-faint"
				>
					Open slot · nothing that size is waiting
				</div>
			{/each}
		{/each}
	</Panel>
{:else}
	<Panel title="Eat the frog" meta={frog?.frog ? 'Your pick' : frog ? 'Suggested' : ''}>
		{#if frog}
			<div class="flex flex-col gap-3 border-b border-line px-[18px] py-4" in:fly={{ y: 8 }}>
				<span class="font-mono text-[10px] tracking-[0.12em] text-accent-text uppercase"
					>🐸 {frog.frog ? 'First thing' : 'Suggested · make it your frog to plan it first'}{frogAt
						? ` · ${frogAt.date === today ? minToHM(frogAt.start) : 'next work day'}`
						: ''}</span
				>
				<button
					type="button"
					onclick={() => openTask(frog.id)}
					class="text-left text-[19px] heavy leading-snug hover:underline {frog.status === 'done'
						? 'text-faint line-through'
						: ''}">{frog.title}</button
				>
				<span class="text-[13px] text-ink-3"
					>Your hardest, most important job. Do it before anything else and the rest of the day is
					downhill.</span
				>
				<div class="flex flex-wrap items-center gap-2">
					{#if frog.status !== 'done'}
						<Button size="sm" variant="primary" icon="focus" onclick={() => startFocus(frog)}
							>Start the frog</Button
						>
						<Button size="sm" icon="check" onclick={() => workspace.complete(frog.id)}>Done</Button>
						{#if !frog.frog}
							<Button size="sm" variant="ghost" onclick={() => workspace.setFrog(frog.id)}
								>Make it my frog</Button
							>
						{/if}
					{:else}
						<Badge fill tone="lead" label="Frog eaten" />
					{/if}
				</div>
				<Select
					bind:value={frogPick}
					options={frogOptions}
					aria-label="Choose today's frog"
					onchange={() => {
						if (frogPick) workspace.setFrog(frogPick);
						frogPick = '';
					}}
				/>
			</div>
		{:else}
			<p class="m-0 px-[18px] py-6 text-sm text-muted">No frog yet. Capture something important.</p>
		{/if}
		{#if afterFrog.length}
			<div
				class="border-b border-line bg-panel px-[18px] py-2 font-mono text-[10px] tracking-[0.12em] text-muted uppercase"
			>
				Then
			</div>
			{#each afterFrog as t, i (t.id)}
				{@render row(t, String(i + 1).padStart(2, '0'))}
			{/each}
		{/if}
	</Panel>
{/if}
