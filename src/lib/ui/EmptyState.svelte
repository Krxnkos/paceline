<script lang="ts">
	import type { Snippet } from 'svelte';
	import Mark from './Mark.svelte';

	let { title, body, action }: { title: string; body?: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted">
	<span class="opacity-50"><Mark width={44} lead="var(--line-3)" ink="var(--line-2)" /></span>
	<p class="m-0 text-[15px] font-bold text-ink">{title}</p>
	{#if body}<p class="m-0 max-w-sm text-[13.5px] leading-relaxed">{body}</p>{/if}
	{#if action}<div class="mt-1">{@render action()}</div>{/if}
</div>
