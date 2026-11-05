<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppShell from '#lib/shell/AppShell.svelte';
	import UsernameGate from '#lib/auth/UsernameGate.svelte';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { THEMES, theme } from '#lib/stores/theme.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { connection } from '#lib/stores/connection.svelte.ts';
	import ConnectionNotice from '#lib/shell/ConnectionNotice.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Route guard: signed-out visitors go to /login; a first sign-in lands on /onboarding.
	$effect(() => {
		if (!auth.ready) return;
		if (!auth.user) {
			workspace.unload();
			goto('/login', { replace: true });
			return;
		}
		void workspace.load(auth.user.id);
	});

	$effect(() => {
		if (workspace.status === 'empty' && page.url.pathname !== '/onboarding')
			goto('/onboarding', { replace: true });
	});

	// settings.theme follows the person; localStorage is only the pre-paint cache.
	$effect(() => {
		const t = workspace.data?.settings.theme;
		if (!t) return;
		// A theme from a lapsed plan falls back to the system default.
		const known = THEMES.find((x) => x.id === t);
		const want = known && workspace.themeAllowed(known) ? t : 'system';
		if (want !== theme.choice) theme.set(want);
	});

	// Each minute: fix the lit block, and notice when it ends.
	$effect(() => {
		void clock.minute;
		if (workspace.status === 'ready') untrack(() => workspace.tick());
	});

	// Back at the tab after a while: is the session still good, and is the plan current?
	let lastCheck = Date.now();
	async function recheck() {
		if (!auth.user || Date.now() - lastCheck < 60_000) return;
		lastCheck = Date.now();
		await auth.refresh();
		if (!connection.issue) await workspace.refresh();
	}

	const ready = $derived(
		!!auth.user &&
			(!!workspace.data || (workspace.status === 'empty' && page.url.pathname === '/onboarding'))
	);
</script>

<svelte:window
	ononline={() => {
		workspace.retry();
		void auth.refresh();
	}}
	onfocus={recheck}
/>
<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && recheck()} />

<ConnectionNotice />

{#if ready && !auth.user?.username}
	<UsernameGate />
{:else if ready}
	<AppShell>
		{@render children()}
	</AppShell>
{:else if workspace.status === 'error'}
	<div class="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
		<span class="eyebrow">Can’t reach your plan</span>
		<p class="m-0 max-w-sm text-sm text-ink-3">Check your connection, then try again.</p>
		<button
			type="button"
			class="h-10 border border-line-3 px-4 text-sm font-bold hover:bg-hover"
			onclick={() => auth.user && workspace.load(auth.user.id)}>Try again</button
		>
	</div>
{:else}
	<div class="flex h-dvh items-center justify-center">
		<span class="eyebrow">Loading your plan…</span>
	</div>
{/if}
