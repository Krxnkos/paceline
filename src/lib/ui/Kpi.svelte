<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
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
	// Numbers ease to their new value instead of jumping.
	const numeric = $derived(typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)));
	const digits = $derived(String(value).split('.')[1]?.length ?? 0);
	const pad = $derived(/^0\d/.test(String(value)) ? String(value).length : 0);
	const shown = new Tween(0, { duration: 600, easing: cubicOut });
	$effect(() => {
		if (numeric) shown.target = Number(value);
	});
	const text = $derived(numeric ? shown.current.toFixed(digits).padStart(pad, '0') : String(value));
	const color = {
		ink: 'text-ink',
		late: 'text-flare',
		warn: 'text-amber',
		lead: 'text-accent-text'
	};
</script>

<div class="flex flex-col gap-1.5 border-line px-5 py-[18px] {highlight ? 'bg-surface' : ''}">
	<span class="text-[40px] heavy leading-none {color[tone]}"
		>{text}{#if unit}<span class="text-[20px] text-muted">{unit}</span>{/if}</span
	>
	<span class="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{label}</span>
</div>
