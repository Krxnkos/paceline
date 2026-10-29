<script lang="ts">
	import '../app.css';
	import Toaster from '#lib/ui/Toaster.svelte';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { focus } from '#lib/stores/focus.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	theme.init();
	clock.start();
	auth.init();
	focus.init();
</script>

<svelte:head>
	<title>Paceline</title>
</svelte:head>

{@render children()}
<Toaster />
