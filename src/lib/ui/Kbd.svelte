<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<kbd
	class="rounded-xs border border-line-2 px-1.5 py-[3px] font-mono text-[10px] leading-none font-medium text-muted"
	>{@render children()}</kbd
>
