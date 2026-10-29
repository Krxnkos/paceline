<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		checked = false,
		label,
		disabled = false,
		size = 20,
		onchange
	}: {
		checked?: boolean;
		label: string;
		disabled?: boolean;
		size?: number;
		onchange?: () => void;
	} = $props();
</script>

<button
	type="button"
	role="checkbox"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	onclick={(e) => {
		e.stopPropagation();
		onchange?.();
	}}
	class="inline-flex flex-none items-center justify-center rounded-[1px] border transition-colors duration-150 {checked
		? 'border-accent bg-accent text-accent-ink'
		: 'border-line-3 bg-transparent hover:border-ink-3'} disabled:opacity-40"
	style="width: {size}px; height: {size}px"
>
	{#if checked}<Icon name="check" size={Math.round(size * 0.6)} stroke={3.4} />{/if}
</button>
