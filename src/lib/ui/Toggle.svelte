<script lang="ts">
	let {
		checked = false,
		label,
		hint,
		onchange
	}: {
		checked?: boolean;
		label: string;
		hint?: string;
		onchange?: (v: boolean) => void;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	onclick={() => onchange?.(!checked)}
	class="inline-flex min-h-11 items-center gap-3 text-left text-[14px] text-ink-2"
>
	<span
		class="relative inline-block h-[18px] w-[34px] flex-none border transition-colors {checked
			? 'border-accent bg-accent'
			: 'border-line-3'}"
	>
		<span
			class="absolute top-[2px] left-[2px] size-3 transition-transform duration-150 {checked
				? 'translate-x-4 bg-accent-ink'
				: 'bg-muted'}"
		></span>
	</span>
	<span
		>{label}{#if hint}<span class="text-muted"> · {hint}</span>{/if}</span
	>
</button>
