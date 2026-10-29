<script lang="ts">
	import { toasts } from '../stores/toast.svelte.ts';
</script>

<div
	class="pointer-events-none fixed inset-x-4 bottom-[84px] z-90 flex flex-col items-start gap-2 nav:inset-x-auto nav:bottom-6 nav:left-[calc(232px+24px)]"
	aria-live="polite"
>
	{#each toasts.items as t (t.id)}
		<div
			class="pointer-events-auto flex max-w-[min(520px,100%)] animate-pop items-center gap-4 py-2.5 pr-2.5 pl-4 text-[13.5px] font-semibold {t.tone ===
			'err'
				? 'bg-flare text-signal-ink'
				: 'bg-ink text-canvas'}"
			role="status"
		>
			<span>{t.msg}</span>
			{#if t.action}
				<button
					type="button"
					class="h-8 border border-canvas/30 px-3 font-mono text-[11px] tracking-[0.1em] uppercase hover:bg-canvas/15"
					onclick={() => {
						t.onAction?.();
						toasts.dismiss(t.id);
					}}>{t.action}</button
				>
			{/if}
		</div>
	{/each}
</div>
