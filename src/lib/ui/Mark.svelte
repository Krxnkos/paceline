<script lang="ts">
	// The formation mark: four timeboxes in a cascade, lead block lit, 14° lean.
	let {
		width = 38,
		lead = 'var(--accent)',
		ink = 'var(--ink)',
		label
	}: { width?: number; lead?: string; ink?: string; label?: string } = $props();
</script>

<svg
	{width}
	height={Math.round((width * 84) / 132)}
	viewBox="0 0 132 84"
	class="flex-none"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<g transform="translate(21 0) skewX(-14)">
		<rect x="0" y="0" width="58" height="14" fill={ink}></rect>
		<rect x="20" y="23" width="62" height="14" fill={ink}></rect>
		<rect x="40" y="46" width="66" height="14" fill={ink}></rect>
		<rect x="60" y="69" width="70" height="14" fill={lead}></rect>
	</g>
</svg>
