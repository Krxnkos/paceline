<script lang="ts" generics="T extends string">
	let {
		value,
		options,
		label,
		onchange
	}: { value: T; options: { id: T; label: string }[]; label: string; onchange: (v: T) => void } =
		$props();
</script>

<div role="group" aria-label={label} class="inline-flex flex-wrap border border-line-2">
	{#each options as o, i (o.id)}
		<button
			type="button"
			aria-pressed={value === o.id}
			onclick={() => onchange(o.id)}
			class="h-9 px-3 text-[12.5px] font-semibold transition-colors {i < options.length - 1
				? 'border-r border-line-2'
				: ''} {value === o.id ? 'bg-sel text-ink' : 'text-muted hover:bg-hover hover:text-ink'}"
		>
			{o.label}
		</button>
	{/each}
</div>
