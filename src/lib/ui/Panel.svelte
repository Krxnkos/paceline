<script lang="ts">
	import type { Snippet } from 'svelte';
	import { panelHead } from './styles.ts';

	let {
		title,
		meta,
		metaClass = '',
		label,
		surface = false,
		class: cls = '',
		head,
		children
	}: {
		title?: string;
		meta?: string;
		metaClass?: string;
		label?: string;
		surface?: boolean;
		class?: string;
		head?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section
	aria-label={label ?? title}
	class="min-w-0 border border-line {surface ? 'bg-surface' : ''} {cls}"
>
	{#if title || head}
		<div class={panelHead}>
			{#if head}{@render head()}{:else}<span>{title}</span>{#if meta}<span class={metaClass}
						>{meta}</span
					>{/if}{/if}
		</div>
	{/if}
	{@render children()}
</section>
