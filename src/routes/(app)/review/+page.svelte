<script lang="ts">
	import { fly, slide } from 'svelte/transition';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import CaptureBar from '#lib/task/CaptureBar.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { code } from '#lib/domain/forecast.ts';
	import { addDays, fmtHours, fmtShort } from '#lib/domain/dates.ts';
	import { loggedHours } from '#lib/domain/stats.ts';
	import type { Task } from '#lib/types.ts';

	/**
	 * A GTD-style weekly review in three passes: get clear, get current, get creative.
	 * Each step shows the live list it's about, so the review is also where you act.
	 */
	const today = $derived(clock.today);
	const open = $derived(workspace.tasks.filter((t) => t.status !== 'done'));
	const inbox = $derived(open.filter((t) => t.inbox));
	const overdue = $derived(open.filter((t) => !t.inbox && t.due && t.due < today));
	const waiting = $derived(open.filter((t) => t.waiting || t.quadrant === 'delegate'));
	const someday = $derived(open.filter((t) => t.someday || t.quadrant === 'drop'));
	const stalled = $derived(
		workspace.projects.filter(
			(p) =>
				!open.some(
					(t) =>
						t.projectId === p.id &&
						!t.someday &&
						!t.waiting &&
						(workspace.plan.placed[t.id] || t.quick)
				)
		)
	);
	const lastWeek = $derived({
		done: workspace.tasks.filter(
			(t) => t.status === 'done' && t.doneAt && t.doneAt >= addDays(today, -7)
		).length,
		hours: loggedHours(workspace.tasks, addDays(today, -7), today)
	});
	const coming = $derived(
		[
			...workspace.meetings
				.filter((m) => m.date >= today && m.date <= addDays(today, 14))
				.map((m) => ({ key: m.id, date: m.date, text: `${m.start} ${m.title}`, kind: 'Meeting' })),
			...open
				.filter((t) => t.due && t.due >= today && t.due <= addDays(today, 14))
				.map((t) => ({ key: t.id, date: t.due!, text: t.title, kind: 'Due' }))
		].sort((a, b) => (a.date < b.date ? -1 : 1))
	);

	// Ticks are for this sitting only; finishing the review records the date.
	let ticked = $state<Record<string, boolean>>({});
	const STEPS = [
		{ id: 'inbox', phase: 'Get clear', title: 'Empty the inbox' },
		{ id: 'capture', phase: 'Get clear', title: 'Get loose ends out of your head' },
		{ id: 'overdue', phase: 'Get current', title: 'Deal with anything overdue' },
		{ id: 'waiting', phase: 'Get current', title: 'Chase what you’re waiting for' },
		{ id: 'projects', phase: 'Get current', title: 'Give every project a next action' },
		{ id: 'calendar', phase: 'Get current', title: 'Look back a week, ahead two' },
		{ id: 'someday', phase: 'Get creative', title: 'Review Someday/Maybe' }
	] as const;
	const auto = $derived<Record<string, boolean>>({
		inbox: inbox.length === 0,
		overdue: overdue.length === 0,
		projects: stalled.length === 0
	});
	const done = (id: string) => !!ticked[id] || !!auto[id];
	const progress = $derived(STEPS.filter((s) => done(s.id)).length);

	function activate(t: Task) {
		workspace.updateTask(t.id, { someday: false, waiting: null, quadrant: null });
	}
</script>

<svelte:head><title>Paceline · Weekly review</title></svelte:head>

{#snippet taskRow(t: Task, actions: import('svelte').Snippet)}
	<div
		class="flex items-center gap-3 border-b border-line py-2 last:border-0"
		out:slide={{ duration: 180 }}
	>
		<span class="font-mono text-[10.5px] text-faint">{code(t.code)}</span>
		<button
			type="button"
			class="min-w-0 flex-1 truncate text-left text-[13.5px] hover:underline"
			onclick={() => openTask(t.id)}>{t.title}</button
		>
		{@render actions()}
	</div>
{/snippet}

<div class="mx-auto flex max-w-[860px] flex-col gap-6 px-4 pt-7 pb-16 nav:px-8">
	<PageHead
		index="14"
		eyebrow="Weekly review · {workspace.settings.lastReview
			? `last done ${fmtShort(workspace.settings.lastReview)}`
			: 'first time'}"
		title="Clear, current,"
		accent="creative."
	/>
	<div class="flex items-center gap-3">
		<div class="h-1.5 flex-1 bg-panel">
			<div
				class="h-1.5 bg-accent transition-[width] duration-500 ease-out"
				style="width: {(progress / STEPS.length) * 100}%"
			></div>
		</div>
		<span class="font-mono text-xs text-muted">{progress}/{STEPS.length}</span>
	</div>

	{#each STEPS as s, i (s.id)}
		<section
			class="flex flex-col gap-3 border p-5 transition-colors {done(s.id)
				? 'border-line bg-surface/50'
				: 'border-line-3'}"
			in:fly={{ y: 10, delay: i * 40, duration: 260 }}
		>
			<div class="flex items-start gap-3">
				<Checkbox
					checked={done(s.id)}
					label={s.title}
					onchange={() => (ticked = { ...ticked, [s.id]: !ticked[s.id] })}
				/>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{s.phase}</span
					>
					<h2 class="m-0 text-[18px] heavy {done(s.id) ? 'text-ink-3' : ''}">{s.title}</h2>
				</div>
			</div>

			{#if s.id === 'inbox'}
				<p class="m-0 text-[13.5px] text-ink-3">
					{inbox.length
						? `${inbox.length} item${inbox.length === 1 ? '' : 's'} still to triage.`
						: 'Inbox zero.'}
				</p>
				{#if inbox.length}<div>
						<Button size="sm" href="/inbox" iconRight="arrowRight">Open the inbox</Button>
					</div>{/if}
			{:else if s.id === 'capture'}
				<p class="m-0 text-[13.5px] text-ink-3">
					Notes, emails, promises, ideas: anything nagging at you. It lands in the inbox.
				</p>
				<CaptureBar inbox placeholder="Something on your mind…" />
			{:else if s.id === 'overdue'}
				{#each overdue as t (t.id)}
					{#snippet acts()}
						<span class="font-mono text-[10.5px] text-flare">due {fmtShort(t.due!)}</span>
						<Button
							size="sm"
							variant="ghost"
							onclick={() => workspace.updateTask(t.id, { due: null })}>Clear date</Button
						>
						<Button size="sm" variant="ghost" onclick={() => workspace.complete(t.id)}>Done</Button>
					{/snippet}
					{@render taskRow(t, acts)}
				{:else}
					<p class="m-0 text-[13.5px] text-ink-3">Nothing overdue.</p>
				{/each}
			{:else if s.id === 'waiting'}
				{#each waiting as t (t.id)}
					{#snippet acts()}
						<span class="max-w-[160px] truncate font-mono text-[10.5px] text-amber"
							>{t.waiting ?? 'delegated'}</span
						>
						<Button size="sm" variant="ghost" onclick={() => activate(t)}>Got it back</Button>
					{/snippet}
					{@render taskRow(t, acts)}
				{:else}
					<p class="m-0 text-[13.5px] text-ink-3">
						Nothing parked as waiting. Set “Waiting for” on a task when it’s in someone else’s
						hands.
					</p>
				{/each}
			{:else if s.id === 'projects'}
				{#each stalled as p (p.id)}
					<div
						class="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
					>
						<a href="/projects/{p.id}" class="truncate text-[13.5px] font-semibold hover:underline"
							>{p.name}</a
						>
						<Button
							size="sm"
							variant="ghost"
							icon="plus"
							onclick={() => (ui.newTask = { open: true, defaults: { projectId: p.id } })}
							>Next action</Button
						>
					</div>
				{:else}
					<p class="m-0 text-[13.5px] text-ink-3">Every project has something planned.</p>
				{/each}
			{:else if s.id === 'calendar'}
				<p class="m-0 text-[13.5px] text-ink-3">
					Last 7 days: {lastWeek.done} task{lastWeek.done === 1 ? '' : 's'} done, {fmtHours(
						lastWeek.hours * 60
					)} h of focus logged.
				</p>
				{#each coming.slice(0, 12) as c (c.key)}
					<div
						class="flex items-center gap-3 border-b border-line py-1.5 text-[13px] last:border-0"
					>
						<span class="w-20 font-mono text-[11px] text-muted">{fmtShort(c.date)}</span>
						<span class="w-16 font-mono text-[10px] tracking-[0.08em] text-faint uppercase"
							>{c.kind}</span
						>
						<span class="truncate">{c.text}</span>
					</div>
				{:else}
					<p class="m-0 text-[13.5px] text-ink-3">Nothing due or booked in the next two weeks.</p>
				{/each}
			{:else if s.id === 'someday'}
				{#each someday as t (t.id)}
					{#snippet acts()}
						<Button size="sm" variant="ghost" onclick={() => activate(t)}>Activate</Button>
						<Button size="sm" variant="ghost" onclick={() => workspace.deleteTask(t.id)}
							>Delete</Button
						>
					{/snippet}
					{@render taskRow(t, acts)}
				{:else}
					<p class="m-0 text-[13.5px] text-ink-3">
						No someday items. Park ideas there from a task’s drawer so they stop nagging.
					</p>
				{/each}
				<div class="flex flex-wrap gap-2 pt-1">
					<Button size="sm" icon="plus" onclick={() => ui.openProject()}>New project</Button>
					<Button size="sm" icon="plus" onclick={() => ui.openGoal()}>New goal</Button>
				</div>
			{/if}
		</section>
	{/each}

	<div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
		<span class="text-[13.5px] text-ink-3"
			>Do this every week or so. It’s what keeps the plan worth trusting.</span
		>
		<Button variant="primary" icon="check" onclick={() => workspace.finishReview()}
			>Finish review</Button
		>
	</div>
</div>
