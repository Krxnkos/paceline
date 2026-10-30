<script lang="ts">
	import Mark from '../ui/Mark.svelte';
	import { auth } from '../stores/auth.svelte.ts';
	import { inputLg } from '../ui/styles.ts';

	let value = $state('');
	let error = $state('');
	let busy = $state(false);
	let confirming = $state(false);

	const clean = $derived(value.trim().replace(/^@/, '').toLowerCase());

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!confirming) {
			error = /^[a-z][a-z0-9_]{2,19}$/.test(clean)
				? ''
				: 'Use 3–20 letters, numbers or underscores, starting with a letter.';
			confirming = !error;
			return;
		}
		busy = true;
		const r = await auth.setUsername(clean);
		busy = false;
		if (!r.ok) {
			error = r.error ?? 'Could not save that username.';
			confirming = false;
		}
	}
</script>

<svelte:head><title>Paceline · Choose a username</title></svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-canvas px-6 py-10">
	<form onsubmit={submit} class="flex w-full max-w-[420px] flex-col gap-[18px]">
		<Mark width={54} label="Paceline" />
		<h1 class="m-0 text-[30px] font-extrabold wide">Choose your username</h1>
		<p class="m-0 text-[15px] leading-normal text-ink-3">
			This is how you appear in Paceline. <strong class="text-ink">It’s permanent</strong>, so
			choose carefully.
		</p>
		<label class="flex flex-col gap-2">
			<span class="font-mono text-[11px] tracking-[0.14em] text-muted">USERNAME</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				autofocus
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				maxlength="21"
				placeholder="your_name"
				bind:value
				oninput={() => ((error = ''), (confirming = false))}
				aria-invalid={!!error}
				class={inputLg}
			/>
			{#if error}<span class="text-[13px] text-flare">{error}</span>{/if}
		</label>
		{#if confirming}
			<p class="m-0 border-l-2 border-amber bg-surface px-3.5 py-2.5 text-sm">
				You’ll be <strong>@{clean}</strong> for good. This can’t be changed later.
			</p>
		{/if}
		<button
			type="submit"
			disabled={busy}
			class="h-[52px] bg-accent text-[15px] font-extrabold text-accent-ink hover:bg-accent-hi disabled:opacity-60"
			>{confirming ? `Yes, I’m @${clean}` : 'Continue'}</button
		>
	</form>
</div>
