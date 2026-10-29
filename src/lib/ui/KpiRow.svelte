<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, min = 170 }: { children: Snippet; min?: number } = $props();
</script>

<div
	class="grid border-t border-l border-line [&>*]:border-r [&>*]:border-b"
	style="grid-template-columns: repeat(auto-fit, minmax({min}px, 1fr))"
>
	{@render children()}
</div>
