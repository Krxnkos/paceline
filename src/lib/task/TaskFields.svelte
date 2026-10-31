<script lang="ts">
	// The editable property grid shared by the drawer and the new-task modal.
	import type { Task } from '../types.ts';
	import { CATEGORIES, REPEATS, START_MODES } from '../types.ts';
	import LabelPicker from './LabelPicker.svelte';
	import { workspace } from '../stores/workspace.svelte.ts';
	import Select from '../ui/Select.svelte';
	import { input, label } from '../ui/styles.ts';

	let {
		task = $bindable(),
		onchange
	}: { task: Partial<Task>; onchange?: (patch: Partial<Task>) => void } = $props();

	const projectOptions = $derived([
		{ value: '', label: 'No project' },
		...workspace.projects.map((p) => ({
			value: p.id,
			label: `P-${String(p.code).padStart(2, '0')} · ${p.name}`
		}))
	]);

	function set<K extends keyof Task>(key: K, value: Task[K]) {
		task[key] = value;
		onchange?.({ [key]: value } as Partial<Task>);
	}

	let projectValue = $derived(task.projectId ?? '');
	let estH = $derived(Math.floor((task.estimateMin ?? 0) / 60));
	let estM = $derived((task.estimateMin ?? 0) % 60);
</script>

<div class="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5">
	{#if task.status !== undefined}
		<span class={label}>Status</span>
		<Select
			value={task.status}
			options={workspace.columns.map((s) => ({ value: s.id, label: s.label }))}
			onchange={(e) => set('status', e.currentTarget.value as Task['status'])}
			aria-label="Status"
		/>
	{/if}

	<span class={label}>Project</span>
	<Select
		value={projectValue}
		options={projectOptions}
		onchange={(e) => set('projectId', e.currentTarget.value || null)}
		aria-label="Project"
	/>

	<span class={label}>Category</span>
	<Select
		value={task.category ?? 'Deep Work'}
		options={CATEGORIES.map((c) => ({ value: c, label: c }))}
		onchange={(e) => set('category', e.currentTarget.value as Task['category'])}
		aria-label="Category"
	/>

	<span class={label}>Type</span>
	<Select
		value={task.scope ?? 'work'}
		disabled={!workspace.tier.personal}
		options={[
			{ value: 'work', label: 'Work' },
			{ value: 'personal', label: workspace.tier.personal ? 'Personal' : 'Personal · Pro' }
		]}
		onchange={(e) => set('scope', e.currentTarget.value as Task['scope'])}
		aria-label="Task type"
	/>

	<span class={label}>Priority</span>
	<Select
		value={task.priority ?? 3}
		options={[1, 2, 3, 4, 5].map((p) => ({
			value: p,
			label: p === 1 ? 'P1 · Critical' : p === 5 ? 'P5 · Someday' : `P${p}`
		}))}
		onchange={(e) => set('priority', Number(e.currentTarget.value) as Task['priority'])}
		aria-label="Priority"
	/>

	<span class={label}>Estimate</span>
	<div class="flex items-center gap-2">
		<input
			type="number"
			min="0"
			max="99"
			value={estH}
			aria-label="Estimate hours"
			class="{input} w-20 font-mono"
			onchange={(e) =>
				set('estimateMin', Math.max(0, Number(e.currentTarget.value) || 0) * 60 + estM)}
		/>
		<span class="font-mono text-xs text-muted">H</span>
		<input
			type="number"
			min="0"
			max="59"
			step="5"
			value={estM}
			aria-label="Estimate minutes"
			class="{input} w-20 font-mono"
			onchange={(e) =>
				set(
					'estimateMin',
					estH * 60 + Math.min(59, Math.max(0, Number(e.currentTarget.value) || 0))
				)}
		/>
		<span class="font-mono text-xs text-muted">MIN</span>
	</div>

	<span class={label}>Due</span>
	<input
		type="date"
		value={task.due ?? ''}
		aria-label="Due date"
		class="{input} font-mono text-[13px]"
		onchange={(e) => set('due', e.currentTarget.value || null)}
	/>

	<span class={label}>Starts</span>
	<div class="flex flex-wrap gap-2">
		<Select
			value={task.start ?? 'auto'}
			options={START_MODES.map((s) => ({ value: s.id, label: s.label }))}
			onchange={(e) => set('start', e.currentTarget.value as Task['start'])}
			aria-label="Start mode"
			class="min-w-0 flex-1"
		/>
		{#if task.start === 'date'}
			<input
				type="date"
				value={task.startDate ?? ''}
				aria-label="Start date"
				class="{input} w-40 font-mono text-[13px]"
				onchange={(e) => set('startDate', e.currentTarget.value || null)}
			/>
		{/if}
	</div>

	<span class={label}>Repeat</span>
	<Select
		value={task.repeat ?? ''}
		options={REPEATS.map((r) => ({ value: r.id, label: r.label }))}
		onchange={(e) => set('repeat', e.currentTarget.value as Task['repeat'])}
		aria-label="Repeat"
	/>

	<span class={label}>Labels</span>
	<LabelPicker selected={task.labels ?? []} onchange={(labels) => set('labels', labels)} />
</div>
