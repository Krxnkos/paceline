<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import CaptureBar from '#lib/task/CaptureBar.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { code } from '#lib/domain/forecast.ts';
	import { diffDays, fmtRelative } from '#lib/domain/dates.ts';
	import { SYNTAX_REFERENCE } from '#lib/domain/parse.ts';
	import type { Task } from '#lib/types.ts';

	const items = $derived(
		workspace.tasks.filter((t) => t.inbox && t.status !== 'done').sort((a, b) => a.code - b.code)
	);
	const projectOptions = $derived([
		{ value: '', label: 'No project' },
		...workspace.projects.map((p) => ({ value: p.id, label: p.name }))
	]);
	const estOptions = [
		{ value: 0, label: 'Estimate…' },
		...[10, 15, 30, 45, 60, 90, 120, 180, 240].map((m) => ({
			value: m,
			label: m < 60 ? `${m}m` : `${m / 60}h`
		}))
	];
	const small = '[&_select]:h-8 [&_select]:text-xs';

	function plan(t: Task) {
		workspace.updateTask(t.id, { inbox: false, status: 'next', estimateMin: t.estimateMin || 30 });
		toast(`Planned ${code(t.code)}`, { action: 'Undo', onAction: () => workspace.undo() });
	}

	function captured(t: Task) {
		const n = diffDays(clock.today, t.createdAt);
		return n === 0
			? 'Captured today'
			: n === 1
				? 'Captured yesterday'
				: `Captured ${fmtRelative(t.createdAt, clock.today)}`;
	}
</script>

<svelte:head><title>Paceline · Inbox</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-12 nav:px-8">
	<PageHead
		index="02"
		eyebrow="Inbox · {items.length} to triage"
		title={items.length ? 'Give it a place.' : 'Inbox zero.'}
	/>

	<CaptureBar
		inbox
		placeholder="Anything on your mind · it lands here until it has a project, date or estimate"
	/>

	<div class="flex flex-wrap items-start gap-6">
		<Panel title="To triage" meta={String(items.length).padStart(2, '0')} class="flex-[2_1_560px]">
			{#each items as t (t.id)}
				<div
					class="flex flex-col gap-2.5 border-b border-line px-[18px] py-3.5"
					animate:flip={{ duration: 240, easing: cubicOut }}
					in:fly={{ y: -8, duration: 220 }}
					out:fly={{ x: 40, duration: 200 }}
				>
					<div class="flex items-center gap-3">
						<Checkbox
							checked={false}
							label="Complete {t.title}"
							onchange={() => workspace.complete(t.id)}
						/>
						<button
							type="button"
							class="flex-1 text-left text-[15px] font-semibold hover:underline"
							onclick={() => openTask(t.id)}>{t.title}</button
						>
						<span class="font-mono text-[11px] text-faint">{code(t.code)}</span>
					</div>
					<div class="flex flex-wrap items-center gap-2 pl-8">
						<span class="mr-1 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase"
							>{captured(t)}</span
						>
						<Select
							value={t.projectId ?? ''}
							options={projectOptions}
							aria-label="Project"
							class="w-44 {small}"
							onchange={(e) =>
								workspace.updateTask(t.id, { projectId: e.currentTarget.value || null })}
						/>
						<Select
							value={t.category}
							options={workspace.catNames.map((c) => ({ value: c, label: c }))}
							aria-label="Category"
							class="w-32 {small}"
							onchange={(e) =>
								workspace.updateTask(t.id, { category: e.currentTarget.value as Task['category'] })}
						/>
						<Select
							value={t.estimateMin}
							options={estOptions}
							aria-label="Estimate"
							class="w-28 {small}"
							onchange={(e) =>
								workspace.updateTask(t.id, { estimateMin: Number(e.currentTarget.value) })}
						/>
						<input
							type="date"
							value={t.due ?? ''}
							aria-label="Due date"
							class="h-8 rounded-xs border border-line-2 bg-surface px-2 font-mono text-xs text-ink focus:border-ink-3 focus:outline-none"
							onchange={(e) => workspace.updateTask(t.id, { due: e.currentTarget.value || null })}
						/>
						<Button
							size="sm"
							onclick={() => (
								workspace.updateTask(t.id, {
									inbox: false,
									quick: true,
									estimateMin: t.estimateMin || 10
								}),
								toast('Moved to quick wins')
							)}>Quick win</Button
						>
						<Button size="sm" variant="secondary" iconRight="arrowRight" onclick={() => plan(t)}
							>Plan it</Button
						>
					</div>
				</div>
			{:else}
				<EmptyState
					title="Inbox zero"
					body="Everything has a place. New captures without a project, date or estimate land here."
				/>
			{/each}
		</Panel>

		<Panel title="Capture syntax" class="flex-[1_1_280px]">
			{#each SYNTAX_REFERENCE as s (s.token)}
				<div class="flex flex-col gap-0.5 border-b border-line px-[18px] py-2.5 last:border-0">
					<span class="font-mono text-[12px] text-ink">{s.token}</span>
					<span class="text-[12.5px] text-muted">{s.meaning}</span>
				</div>
			{/each}
		</Panel>
	</div>
</div>
