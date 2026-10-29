<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Field from '../ui/Field.svelte';
	import Select from '../ui/Select.svelte';
	import Segmented from '../ui/Segmented.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { addDays } from '../domain/dates.ts';
	import { input } from '../ui/styles.ts';
	import { CATEGORIES, type Category, type Goal } from '../types.ts';

	let title = $state('');
	let why = $state('');
	let source = $state<Goal['source']>('manual');
	let projectId = $state('');
	let category = $state<Category>('Deep Work');
	let current = $state(0);
	let target = $state(10);
	let unit = $state('');
	let start = $state('');
	let due = $state('');
	let error = $state('');

	$effect(() => {
		if (!ui.goal.open) return;
		const g = ui.goal.goal;
		title = g?.title ?? '';
		why = g?.why ?? '';
		source = g?.source ?? 'manual';
		projectId = g?.projectId ?? workspace.projects[0]?.id ?? '';
		category = g?.category ?? 'Deep Work';
		current = g?.current ?? 0;
		target = g?.target ?? 10;
		unit = g?.unit ?? '';
		start = g?.start ?? clock.today;
		due = g?.due ?? addDays(clock.today, 30);
		error = '';
	});

	function save(e: Event) {
		e.preventDefault();
		if (!title.trim()) return (error = 'Name the goal.');
		if (due <= start) return (error = 'The deadline comes after the start.');
		const g: Omit<Goal, 'id'> = {
			title: title.trim(),
			why: why.trim() || undefined,
			source,
			projectId: source === 'project' ? projectId : undefined,
			category: source === 'logged' ? category : undefined,
			current: Number(current) || 0,
			target: source === 'project' ? 100 : Math.max(1, Number(target) || 1),
			unit: source === 'project' ? '%' : source === 'logged' ? 'h' : unit.trim() || 'done',
			start,
			due
		};
		if (ui.goal.goal) workspace.updateGoal(ui.goal.goal.id, g);
		else workspace.addGoal(g);
		toast(ui.goal.goal ? 'Goal saved' : 'Goal added');
		ui.goal = { open: false };
	}
</script>

<Modal bind:open={ui.goal.open} title={ui.goal.goal ? 'Edit goal' : 'New goal'} width={560}>
	<form id="goal-form" onsubmit={save} class="flex flex-col gap-4">
		<Field label="Goal" {error}
			><input bind:value={title} class={input} placeholder="Bank 30 hours of deep work" /></Field
		>
		<Field label="Why it matters"
			><input bind:value={why} class={input} placeholder="Optional" /></Field
		>
		<div class="flex flex-col gap-2">
			<span class="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase"
				>Progress comes from</span
			>
			<Segmented
				label="Progress source"
				value={source}
				onchange={(v) => (source = v)}
				options={[
					{ id: 'manual', label: 'I update it' },
					{ id: 'logged', label: 'Logged hours' },
					{ id: 'project', label: 'A project' }
				]}
			/>
		</div>
		{#if source === 'project'}
			<Field label="Project">
				<Select
					bind:value={projectId}
					options={workspace.projects.map((p) => ({ value: p.id, label: p.name }))}
				/>
			</Field>
		{:else}
			<div class="grid grid-cols-3 gap-3">
				{#if source === 'manual'}
					<Field label="Current"
						><input type="number" bind:value={current} class="{input} font-mono" /></Field
					>
				{:else}
					<Field label="Category">
						<Select
							bind:value={category}
							options={CATEGORIES.map((c) => ({ value: c, label: c }))}
						/>
					</Field>
				{/if}
				<Field label="Target"
					><input type="number" min="1" bind:value={target} class="{input} font-mono" /></Field
				>
				{#if source === 'manual'}
					<Field label="Unit"><input bind:value={unit} class={input} placeholder="docs" /></Field>
				{:else}
					<Field label="Unit"><input value="hours" disabled class="{input} opacity-60" /></Field>
				{/if}
			</div>
		{/if}
		<div class="grid grid-cols-2 gap-3">
			<Field label="Start"
				><input type="date" bind:value={start} class="{input} font-mono text-[13px]" /></Field
			>
			<Field label="Deadline"
				><input type="date" bind:value={due} class="{input} font-mono text-[13px]" /></Field
			>
		</div>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (ui.goal = { open: false })}>Cancel</Button>
		<Button variant="primary" type="submit" form="goal-form">Save goal</Button>
	{/snippet}
</Modal>
