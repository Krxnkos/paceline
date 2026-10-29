<script lang="ts">
	import type { Snippet } from 'svelte';

	// Eyebrow "06 —— WORK DAY · …" over a heavy page title, actions to the right.
	let {
		index,
		eyebrow,
		title,
		accent,
		actions
	}: { index: string; eyebrow: string; title: string; accent?: string; actions?: Snippet } =
		$props();
</script>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div class="flex min-w-0 flex-col gap-2.5">
		<div
			class="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-muted uppercase"
		>
			<span class="text-accent-text">{index}</span><span class="inline-block h-px w-9 bg-line-3"
			></span>{eyebrow}
		</div>
		<h1 class="m-0 text-[34px] heavy sm:text-[46px]">
			{title}{#if accent}<br /><span class="text-accent-text">{accent}</span>{/if}
		</h1>
	</div>
	{#if actions}<div class="flex flex-wrap gap-2.5">{@render actions()}</div>{/if}
</div>
