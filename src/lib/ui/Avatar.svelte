<script lang="ts">
	import { initials } from '../stores/auth.svelte.ts';
	let { name, size = 32 }: { name: string; size?: number } = $props();
</script>

<span
	class="inline-flex flex-none items-center justify-center bg-line font-mono font-bold text-ink"
	style="width: {size}px; height: {size}px; font-size: {size > 30 ? 12 : 10.5}px"
	aria-hidden="true">{initials(name)}</span
>
