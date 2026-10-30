<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';
	import { TIERS, type Tier } from '../tiers.ts';

	// One tier badge per account; Developer can sit alongside it.
	let { kind }: { kind: Tier | 'developer' } = $props();

	const looks: Record<Tier | 'developer', { icon: IconName; cls: string }> = {
		free: { icon: 'circle', cls: 'border-line-3 text-muted' },
		pro: { icon: 'bolt', cls: 'border-ice text-ice' },
		ultimate: { icon: 'crown', cls: 'border-accent bg-accent text-accent-ink' },
		developer: { icon: 'code', cls: 'border-lilac text-lilac' }
	};
	const label = $derived(kind === 'developer' ? 'Developer' : TIERS[kind].label);
</script>

<span
	class="inline-flex h-5 flex-none items-center gap-1 border px-1.5 font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase {looks[
		kind
	].cls}"
>
	<Icon name={looks[kind].icon} size={11} stroke={2.4} />{label}
</span>
