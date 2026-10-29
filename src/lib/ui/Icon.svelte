<script lang="ts">
	import { ICONS, type IconName } from './icons.ts';

	let {
		name,
		size = 16,
		label,
		stroke = 2,
		class: cls = ''
	}: { name: IconName; size?: number; label?: string; stroke?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="square"
	class="flex-none {cls}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<!-- Paths are static constants from icons.ts, never user input. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ICONS[name]}
</svg>
