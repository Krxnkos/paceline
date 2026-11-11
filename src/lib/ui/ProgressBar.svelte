<script lang="ts">
	let {
		value,
		tone = 'neutral',
		height = 6,
		label = 'Progress',
		track = 'bg-line'
	}: {
		value: number;
		tone?: 'neutral' | 'ink' | 'lead' | 'late' | 'warn';
		height?: number;
		label?: string;
		track?: string;
	} = $props();

	const fill = {
		neutral: 'bg-ink-3',
		ink: 'bg-ink',
		lead: 'bg-accent',
		late: 'bg-flare',
		warn: 'bg-amber'
	};
	const pct = $derived(Math.max(0, Math.min(1, value || 0)));
</script>

<div
	class="relative w-full overflow-hidden {track}"
	style="height: {height}px"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(pct * 100)}
>
	<div
		class="absolute inset-y-0 left-0 {fill[tone]} transition-[width] duration-500 ease-out"
		style="width: {pct * 100}%"
	></div>
</div>
