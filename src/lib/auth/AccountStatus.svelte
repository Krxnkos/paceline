<script lang="ts">
	import PlanBadge from '../ui/PlanBadge.svelte';
	import { tierInfo } from '../tiers.ts';
	import { fmtDayMonth, iso } from '../domain/dates.ts';
	import type { User } from '../stores/auth.svelte.ts';

	// Shown at sign-in: who you are and what your account includes.
	let { user }: { user: User } = $props();

	const plan = $derived(tierInfo(user.tier));
	const until = $derived(
		user.tierExpiresAt ? fmtDayMonth(iso(new Date(user.tierExpiresAt))) : null
	);
	const text = $derived(
		user.tier === 'free'
			? 'You’re on the Free plan.'
			: `You’re a ${plan.label} member${until ? ` until ${until}` : ''}.`
	);
	const dev = $derived(user.developer ? ' You have Developer access.' : '');
</script>

<div class="flex flex-col gap-2 border border-line p-3.5">
	<span class="flex flex-wrap items-center gap-1.5">
		<PlanBadge kind={user.tier} />
		{#if user.developer}<PlanBadge kind="developer" />{/if}
	</span>
	<span class="text-sm text-ink-2">{text}{dev}</span>
</div>
