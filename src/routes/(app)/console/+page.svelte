<script lang="ts">
	import { tick } from 'svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { api, auth } from '#lib/stores/auth.svelte.ts';

	interface Line {
		text: string;
		tone?: 'ok' | 'err' | 'muted' | 'input';
	}

	let lines = $state<Line[]>([
		{ text: 'Paceline console. Type help for commands.', tone: 'muted' }
	]);
	let value = $state('');
	let busy = $state(false);
	let history = $state<string[]>([]);
	let cursor = -1;
	let screen: HTMLDivElement | undefined = $state();
	let field: HTMLInputElement | undefined = $state();

	const tones = {
		ok: 'text-accent-text',
		err: 'text-flare',
		muted: 'text-muted',
		input: 'text-ink'
	};

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const command = value.trim();
		if (!command || busy) return;
		value = '';
		cursor = -1;
		history = [command, ...history].slice(0, 50);
		if (command.toLowerCase() === 'clear') {
			lines = [];
			return;
		}
		lines = [...lines, { text: `> ${command}`, tone: 'input' }];
		busy = true;
		const r = await api<{ lines: Line[] }>('POST', '/api/console', { command });
		busy = false;
		lines = [
			...lines,
			...(r.ok ? r.data!.lines : [{ text: r.error ?? 'Failed.', tone: 'err' as const }])
		];
		await tick();
		screen?.scrollTo({ top: screen.scrollHeight });
		field?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		cursor = Math.max(-1, Math.min(history.length - 1, cursor + (e.key === 'ArrowUp' ? 1 : -1)));
		value = history[cursor] ?? '';
	}
</script>

<svelte:head><title>Paceline · Console</title></svelte:head>

{#if !auth.user?.developer}
	<EmptyState title="Developer access required" body="This area is only for Developer accounts." />
{:else}
	<div class="flex h-full flex-col px-4 py-6 nav:px-8">
		<div
			bind:this={screen}
			role="log"
			aria-label="Console output"
			class="min-h-0 flex-1 overflow-auto border border-line bg-panel p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap"
		>
			{#each lines as l, i (i)}<div class={l.tone ? tones[l.tone] : 'text-ink-2'}>
					{l.text}
				</div>{/each}
		</div>
		<form onsubmit={submit} class="flex items-center gap-3 border border-t-0 border-line px-4">
			<span class="font-mono text-accent-text">&gt;</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:this={field}
				bind:value
				{onkeydown}
				autofocus
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				aria-label="Command"
				placeholder="grant @username pro 30d"
				class="h-12 flex-1 bg-transparent font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
			/>
		</form>
	</div>
{/if}
