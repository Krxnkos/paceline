<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	// Native <dialog>: focus trap, Esc and the top layer come for free.
	let {
		open = $bindable(false),
		title,
		width = 600,
		eyebrow,
		children,
		footer,
		onclose
	}: {
		open: boolean;
		title: string;
		width?: number;
		eyebrow?: string;
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="fixed top-[10vh] left-1/2 -translate-x-1/2 open:animate-pop"
	style="width: min({width}px, calc(100vw - 32px))"
>
	{#if open}
		<div class="flex max-h-[80vh] flex-col border border-line-2 bg-surface">
			<div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
				<div class="flex flex-col gap-1">
					{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
					<h2 class="m-0 text-[19px] font-extrabold wide">{title}</h2>
				</div>
				<button
					type="button"
					class="inline-flex size-9 items-center justify-center text-muted hover:bg-hover hover:text-ink"
					aria-label="Close"
					onclick={() => (open = false)}><Icon name="x" /></button
				>
			</div>
			<div class="flex flex-col gap-4 overflow-auto p-5">{@render children()}</div>
			{#if footer}
				<div class="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-5 py-4">
					{@render footer()}
				</div>
			{/if}
		</div>
	{/if}
</dialog>
