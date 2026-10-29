<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		label,
		head,
		children,
		footer,
		onclose
	}: {
		open: boolean;
		label: string;
		head?: Snippet;
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
	aria-label={label}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="fixed inset-y-0 right-0 left-auto h-dvh open:animate-slide"
	style="width: min(480px, 100vw)"
>
	{#if open}
		<div class="flex h-full flex-col border-l border-line-2 bg-surface">
			<div class="flex h-14 flex-none items-center justify-between gap-3 border-b border-line px-6">
				<div class="flex min-w-0 items-center gap-3">{@render head?.()}</div>
				<button
					type="button"
					class="inline-flex size-9 items-center justify-center text-muted hover:bg-hover hover:text-ink"
					aria-label="Close"
					onclick={() => (open = false)}><Icon name="x" /></button
				>
			</div>
			<div class="flex-1 overflow-auto px-6 py-5">{@render children()}</div>
			{#if footer}
				<div
					class="flex flex-none flex-wrap items-center justify-between gap-2.5 border-t border-line px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	{/if}
</dialog>
