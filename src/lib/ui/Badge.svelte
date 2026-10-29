<script lang="ts">
	import type { Tone } from '../types.ts';
	import { toneText, toneBg } from './styles.ts';

	// Status is always a 6px square plus a mono label, never colour alone.
	// `fill` renders the solid chip used on boards and must-dos.
	let {
		tone = 'plain',
		label,
		fill = false
	}: { tone?: Tone; label: string; fill?: boolean } = $props();

	const fillCls: Record<Tone, string> = {
		late: 'bg-flare border-flare text-signal-ink',
		warn: 'bg-amber border-amber text-signal-ink',
		info: 'border-ice text-ice',
		lead: 'bg-accent border-accent text-accent-ink',
		plain: 'border-line-3 text-ink-3',
		mute: 'border-line text-muted'
	};
</script>

{#if fill}
	<span
		class="inline-flex flex-none items-center border px-1.5 py-[3px] font-mono text-[10px] leading-none font-bold tracking-[0.04em] whitespace-nowrap uppercase {fillCls[
			tone
		]}">{label}</span
	>
{:else}
	<span
		class="inline-flex flex-none items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.08em] whitespace-nowrap uppercase {toneText[
			tone
		]}"
	>
		<span class="size-1.5 {toneBg[tone]}"></span>{label}
	</span>
{/if}
