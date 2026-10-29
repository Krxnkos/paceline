<script lang="ts">
	import type { Snippet } from 'svelte';
	import { label as labelCls } from './styles.ts';

	let {
		label,
		hint,
		error,
		aside,
		class: cls = '',
		children
	}: {
		label: string;
		hint?: string;
		error?: string | null;
		aside?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<label class="flex flex-col gap-2 {cls}">
	<span class="flex items-center justify-between {labelCls}">{label}{@render aside?.()}</span>
	{@render children()}
	{#if error}
		<span class="text-[13px] text-flare">{error}</span>
	{:else if hint}
		<span class="text-xs text-muted">{hint}</span>
	{/if}
</label>
