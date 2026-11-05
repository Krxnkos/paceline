<script lang="ts">
	import { tick } from 'svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Kpi from '#lib/ui/Kpi.svelte';
	import KpiRow from '#lib/ui/KpiRow.svelte';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import Button from '#lib/ui/Button.svelte';
	import DeveloperPanel from '#lib/shell/DeveloperPanel.svelte';
	import { api, auth } from '#lib/stores/auth.svelte.ts';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';

	interface Line {
		text: string;
		tone?: 'ok' | 'err' | 'muted' | 'input';
	}

	let lines = $state<Line[]>([{ text: 'Type help for commands.', tone: 'muted' }]);
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

	async function run(command: string) {
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

<svelte:head><title>Paceline · Developer</title></svelte:head>

{#if !auth.user?.developer}
	<EmptyState title="Developer access required" body="This area is only for Developer accounts." />
{:else}
	<div class="flex flex-col gap-6 px-4 pt-7 pb-12 nav:px-8">
		<PageHead index="12" eyebrow="Developer · @{auth.user.username}" title="Developer panel." />

		<KpiRow>
			<Kpi value={workspace.saving} label="Sync" />
			<Kpi value={workspace.version} label="Plan version" />
			<Kpi value={workspace.plan.blocks.length} label="Planned blocks" />
			<Kpi
				value={clock.offset ? 'Travel' : 'Live'}
				label="Clock"
				tone={clock.offset ? 'warn' : 'lead'}
			/>
		</KpiRow>

		<div class="grid items-start gap-6 wide:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
			<Panel title="Accounts console" meta="Runs on the server · logged">
				<div
					bind:this={screen}
					role="log"
					aria-label="Console output"
					class="h-[420px] overflow-auto bg-panel p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap"
				>
					{#each lines as l, i (i)}<div class={l.tone ? tones[l.tone] : 'text-ink-2'}>
							{l.text}
						</div>{/each}
				</div>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						run(value.trim());
					}}
					class="flex items-center gap-3 border-t border-line px-4"
				>
					<span class="font-mono text-accent-text">&gt;</span>
					<input
						bind:this={field}
						bind:value
						{onkeydown}
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						aria-label="Command"
						placeholder="grant @username pro 30d"
						class="h-12 flex-1 bg-transparent font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
					/>
				</form>
				<div class="flex flex-wrap gap-2 border-t border-line p-3">
					{#each ['help', 'users', 'audit'] as c (c)}
						<Button size="sm" onclick={() => run(c)}>{c}</Button>
					{/each}
				</div>
			</Panel>

			<DeveloperPanel />
		</div>
	</div>
{/if}
