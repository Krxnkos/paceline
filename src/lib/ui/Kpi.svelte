<script lang="ts">
	// One cell of the KPI strip: heavy wide numeral over a mono label.
	let {
		value,
		unit,
		label,
		tone = 'ink',
		highlight = false
	}: {
		value: string | number;
		unit?: string;
		label: string;
		tone?: 'ink' | 'late' | 'warn' | 'lead';
		highlight?: boolean;
	} = $props();
	const color = {
		ink: 'text-ink',
		late: 'text-flare',
		warn: 'text-amber',
		lead: 'text-accent-text'
	};
</script>

<div class="flex flex-col gap-1.5 border-line px-5 py-[18px] {highlight ? 'bg-surface' : ''}">
	<span class="text-[40px] heavy leading-none {color[tone]}"
		>{value}{#if unit}<span class="text-[20px] text-muted">{unit}</span>{/if}</span
	>
	<span class="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{label}</span>
</div>
