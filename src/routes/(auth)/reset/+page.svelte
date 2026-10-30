<script lang="ts">
	import { page } from '$app/state';
	import AuthScreen from '#lib/auth/AuthScreen.svelte';
</script>

<svelte:head>
	<title>Paceline · Reset password</title>
	<!-- The token is in the URL: never leak it to other sites. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<AuthScreen initial="reset" token={page.url.searchParams.get('token') ?? ''} />
