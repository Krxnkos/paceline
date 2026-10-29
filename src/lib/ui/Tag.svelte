<script lang="ts">
	import type { Category } from '../types.ts';
	import { catSwatch } from './styles.ts';

	let { label, category, code }: { label: string; category?: Category; code?: string } = $props();
</script>

<span
	class="inline-flex h-5 max-w-full items-center gap-1.5 truncate rounded-[1px] border border-line-2 px-[7px] text-[11.5px] text-ink-3"
>
	{#if category}<span class="size-1.5 flex-none {catSwatch[category]}"></span>{/if}
	{#if code}<span class="font-mono text-[10px] text-faint">{code}</span>{/if}
	<span class="truncate">{label}</span>
</span>
