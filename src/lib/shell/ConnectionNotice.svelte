<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '../ui/Button.svelte';
	import { connection } from '../stores/connection.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { auth } from '../stores/auth.svelte.ts';

	const unsent = $derived(workspace.saving !== 'synced');

	async function signIn() {
		const next = page.url.pathname + page.url.search;
		await goto(`/login?next=${encodeURIComponent(next)}`, { replace: true });
		// Forget the account in memory only; unsent edits stay in this browser's cache.
		workspace.unload();
		auth.user = null;
	}
</script>

{#if connection.issue}
	<div
		class="fixed inset-0 z-[90] flex items-end justify-center bg-canvas/70 p-4 backdrop-blur-[2px] sm:items-center"
	>
		<div
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="conn-title"
			aria-describedby="conn-body"
			class="shadow-2xl flex w-full max-w-[440px] flex-col gap-4 border border-line-3 bg-raised p-6"
		>
			<span class="font-mono text-[10.5px] tracking-[0.14em] text-amber uppercase"
				>{connection.issue === 'challenge' ? 'Security check' : 'Signed out'}</span
			>
			<h2 id="conn-title" class="m-0 text-[22px] heavy leading-tight">
				{connection.issue === 'challenge'
					? 'Cloudflare wants to check this browser again.'
					: 'Your session has ended.'}
			</h2>
			<p id="conn-body" class="m-0 text-[14px] leading-normal text-ink-3">
				{#if connection.issue === 'challenge'}
					Paceline is protected by Cloudflare, which re-checks visitors from time to time. Saves
					can’t get through until it’s done. Reload the page to pass the check.
				{:else}
					For your security you’ve been signed out after a while away. Sign in again to carry on
					where you left off.
				{/if}
				{#if unsent}
					<span class="mt-2 block text-ink-2"
						>Your latest changes are kept on this device and save as soon as you’re back.</span
					>
				{/if}
			</p>
			<div class="flex flex-wrap justify-end gap-2">
				{#if connection.issue === 'challenge'}
					<Button variant="primary" icon="undo" onclick={() => location.reload()}
						>Reload page</Button
					>
				{:else}
					<Button variant="primary" iconRight="arrowRight" onclick={signIn}>Sign in again</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}
