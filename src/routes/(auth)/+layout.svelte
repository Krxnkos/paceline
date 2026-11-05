<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { connection, safeNext } from '#lib/stores/connection.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Signed-in visitors skip the login screens.
	onMount(async () => {
		await auth.init();
		if (auth.user && connection.issue !== 'signedOut') goto(safeNext(page.url), { replace: true });
	});
</script>

{@render children()}
