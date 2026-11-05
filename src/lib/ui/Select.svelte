<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { input } from './styles.ts';

	let {
		value = $bindable(),
		options,
		class: cls = '',
		...rest
	}: HTMLSelectAttributes & {
		value: string | number | null;
		options: { value: string | number; label: string; disabled?: boolean }[];
		class?: string;
	} = $props();
</script>

<span class="relative block {cls}">
	<select bind:value class="{input} cursor-pointer appearance-none pr-8" {...rest}>
		{#each options as o (o.value)}
			<option value={o.value} disabled={o.disabled}>{o.label}</option>
		{/each}
	</select>
	<span
		class="pointer-events-none absolute top-1/2 right-3 size-[7px] -translate-y-[70%] rotate-45 border-r border-b border-muted"
		aria-hidden="true"
	></span>
</span>
