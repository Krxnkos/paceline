<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../ui/Icon.svelte';
	import Select from '../ui/Select.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import { filters } from '../stores/filters.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { CATEGORIES } from '../types.ts';

	let {
		count,
		children,
		showDoneToggle = true
	}: { count?: string; children?: Snippet; showDoneToggle?: boolean } = $props();

	const projectOptions = $derived([
		{ value: 'all', label: 'All projects' },
		{ value: 'none', label: 'No project' },
		...workspace.projects.map((p) => ({ value: p.id, label: p.name }))
	]);
	const catOptions = [
		{ value: 'all', label: 'All categories' },
		...CATEGORIES.map((c) => ({ value: c, label: c }))
	];
</script>

<div class="flex min-h-13 flex-wrap items-center gap-2 border-b border-line py-2.5">
	<label class="relative block">
		<span class="sr-only">Filter tasks</span>
		<span class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
			><Icon name="search" size={14} /></span
		>
		<input
			data-search
			bind:value={filters.q}
			placeholder="Filter tasks"
			class="h-9 w-48 rounded-xs border border-line-2 bg-surface pr-2.5 pl-8 text-[13px] text-ink placeholder:text-faint focus:border-ink-3 focus:outline-none"
		/>
	</label>
	<Select
		bind:value={filters.project}
		options={projectOptions}
		aria-label="Project"
		class="w-48 [&_select]:h-9 [&_select]:text-[13px]"
	/>
	<Select
		bind:value={filters.category}
		options={catOptions}
		aria-label="Category"
		class="w-40 [&_select]:h-9 [&_select]:text-[13px]"
	/>
	{#if showDoneToggle}
		<Toggle label="Show done" checked={filters.showDone} onchange={(v) => (filters.showDone = v)} />
	{/if}
	{#if filters.active}
		<button
			type="button"
			class="h-9 px-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:text-ink"
			onclick={() => filters.reset()}>Clear</button
		>
	{/if}
	{@render children?.()}
	{#if count}<span class="ml-auto font-mono text-[11px] tracking-[0.1em] text-muted uppercase"
			>{count}</span
		>{/if}
</div>
