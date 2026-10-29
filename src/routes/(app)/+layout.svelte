<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppShell from '#lib/shell/AppShell.svelte';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Route guard: signed-out visitors go to /login; a first sign-in lands on /onboarding.
	$effect(() => {
		if (!auth.ready) return;
		if (!auth.user) {
			goto('/login', { replace: true });
			return;
		}
		workspace.load(auth.user.id);
		if (!workspace.data && page.url.pathname !== '/onboarding')
			goto('/onboarding', { replace: true });
	});

	// settings.theme follows the person; localStorage is only the pre-paint cache.
	$effect(() => {
		const t = workspace.data?.settings.theme;
		if (t && t !== theme.choice) theme.set(t);
	});

	const ready = $derived(!!auth.user && (!!workspace.data || page.url.pathname === '/onboarding'));
</script>

{#if ready}
	<AppShell>
		{@render children()}
	</AppShell>
{:else}
	<div class="flex h-dvh items-center justify-center">
		<span class="eyebrow">Loading your plan…</span>
	</div>
{/if}
