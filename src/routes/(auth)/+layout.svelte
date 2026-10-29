<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Signed-in visitors skip the login screens.
	onMount(() => {
		if (auth.user) goto('/today', { replace: true });
	});
</script>

{@render children()}
