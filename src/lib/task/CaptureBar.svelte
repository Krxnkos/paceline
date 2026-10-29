<script lang="ts">
	import { workspace } from '../stores/workspace.svelte.ts';
	import type { Task } from '../types.ts';

	let {
		inbox,
		defaults,
		placeholder = 'Draft report !4 #deep @fri 90m +Project  ·  qw … quick win  ·  mtg … 10:00-10:30'
	}: { inbox?: boolean; defaults?: Partial<Task>; placeholder?: string } = $props();

	let text = $state('');
	const parsed = $derived(text.trim() ? workspace.parse(text) : null);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!text.trim()) return;
		const out = workspace.capture(text, { inbox, defaults });
		if (out) text = '';
	}
</script>

<form onsubmit={submit} class="flex flex-col gap-2">
	<div
		class="flex min-h-[52px] flex-wrap items-stretch border transition-colors {text
			? 'border-accent'
			: 'border-line-3 focus-within:border-ink-3'}"
	>
		<label
			for="pl-capture"
			class="flex items-center bg-accent px-4 font-mono text-xs font-bold tracking-[0.08em] text-accent-ink"
			>CAPTURE</label
		>
		<input
			id="pl-capture"
			data-capture
			bind:value={text}
			autocomplete="off"
			{placeholder}
			class="h-[50px] min-w-[220px] flex-1 bg-transparent px-4 text-base text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
		/>
		<button
			type="submit"
			class="border-l border-line px-[18px] font-mono text-xs text-ink-3 hover:bg-hover hover:text-ink"
			>ADD ↵</button
		>
	</div>
	<div
		class="flex min-h-6 flex-wrap gap-1.5 font-mono text-[11px] tracking-[0.05em]"
		aria-live="polite"
	>
		{#if parsed}
			{#each parsed.chips as c (c.l)}
				<span class="bg-surface px-2 py-1 text-ink-2"
					><span class="text-muted uppercase">{c.l}</span> {c.v}</span
				>
			{/each}
		{/if}
	</div>
</form>
