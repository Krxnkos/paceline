<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '../ui/Icon.svelte';
	import Kbd from '../ui/Kbd.svelte';
	import type { IconName } from '../ui/icons.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { theme, THEMES } from '../stores/theme.svelte.ts';
	import { code } from '../domain/forecast.ts';
	import { ALL_NAV, CONSOLE_NAV } from './nav.ts';
	import { auth } from '../stores/auth.svelte.ts';

	interface Command {
		id: string;
		label: string;
		hint?: string;
		icon: IconName;
		group: 'Tasks' | 'Actions' | 'Go to';
		run: () => void;
	}

	let dialog: HTMLDialogElement | undefined = $state();
	let q = $state('');
	let sel = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (ui.palette && !dialog.open) {
			q = '';
			sel = 0;
			dialog.showModal();
			queueMicrotask(() => inputEl?.focus());
		}
		if (!ui.palette && dialog.open) dialog.close();
	});

	const commands = $derived.by((): Command[] => {
		const query = q.trim().toLowerCase();
		const match = (s: string) => !query || s.toLowerCase().includes(query);
		const tasks: Command[] = workspace.tasks
			.filter((t) => t.status !== 'done' || query)
			.filter((t) => match(`${t.title} ${code(t.code)}`))
			.slice(0, query ? 8 : 4)
			.map((t) => ({
				id: t.id,
				label: t.title,
				hint: code(t.code),
				icon: 'edit',
				group: 'Tasks',
				run: () => openTask(t.id)
			}));
		const actions: Command[] = [
			{
				id: 'new',
				label: query ? `New task “${q.trim()}”` : 'New task',
				hint: 'N',
				icon: 'plus',
				group: 'Actions',
				run: () => ui.openNewTask(undefined, q.trim())
			},
			{
				id: 'mtg',
				label: 'New meeting',
				icon: 'meeting',
				group: 'Actions',
				run: () => ui.openMeeting()
			},
			{
				id: 'proj',
				label: 'New project',
				icon: 'projects',
				group: 'Actions',
				run: () => ui.openProject()
			},
			{ id: 'goal', label: 'New goal', icon: 'goals', group: 'Actions', run: () => ui.openGoal() },
			{
				id: 'focus',
				label: focus.state ? 'Open focus timer' : 'Start a focus block',
				hint: 'F',
				icon: 'focus',
				group: 'Actions',
				run: () => {
					if (!focus.state) focus.start(null);
					ui.focusOpen = true;
				}
			},
			{
				id: 'undo',
				label: 'Undo last change',
				hint: '⌘Z',
				icon: 'undo',
				group: 'Actions',
				run: () => workspace.undo()
			},
			{
				id: 'theme',
				label: 'Next theme',
				icon: 'sun',
				group: 'Actions',
				run: () => {
					const list = THEMES.filter((t) => workspace.tier.themes === 'all' || t.family === 'Volt');
					const i = list.findIndex((t) => t.id === theme.resolved);
					theme.set(list[(i + 1) % list.length].id);
				}
			},
			{
				id: 'keys',
				label: 'Keyboard shortcuts',
				hint: '?',
				icon: 'keyboard',
				group: 'Actions',
				run: () => (ui.shortcuts = true)
			}
		].filter((c) => c.id === 'new' || match(c.label)) as Command[];
		const views: Command[] = [...ALL_NAV, ...(auth.user?.developer ? [CONSOLE_NAV] : [])]
			.filter((n) => match(n.label))
			.map((n) => ({
				id: n.href,
				label: `Go to ${n.label}`,
				hint: `G ${n.key.toUpperCase()}`,
				icon: n.icon,
				group: 'Go to',
				run: () => goto(n.href)
			}));
		return [...tasks, ...actions, ...views];
	});

	function run(c: Command | undefined) {
		if (!c) return;
		ui.palette = false;
		c.run();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			sel = Math.min(commands.length - 1, sel + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sel = Math.max(0, sel - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			run(commands[sel]);
		}
	}

	$effect(() => {
		void q;
		sel = 0;
	});
	$effect(() => {
		document.getElementById(`cmd-${sel}`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<dialog
	bind:this={dialog}
	aria-label="Command palette"
	onclose={() => (ui.palette = false)}
	onclick={(e) => e.target === dialog && (ui.palette = false)}
	class="fixed top-[12vh] left-1/2 -translate-x-1/2 open:animate-pop"
	style="width: min(620px, calc(100vw - 32px))"
>
	{#if ui.palette}
		<div class="flex max-h-[70vh] flex-col border border-line-3 bg-raised">
			<div class="flex items-center gap-3 border-b border-line-2 px-4">
				<span class="text-muted"><Icon name="search" /></span>
				<input
					bind:this={inputEl}
					bind:value={q}
					{onkeydown}
					class="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint focus-visible:outline-none"
					placeholder="Search tasks, run a command, jump to a view…"
					role="combobox"
					aria-expanded="true"
					aria-controls="cmd-list"
					aria-activedescendant="cmd-{sel}"
					aria-label="Command"
				/>
				<Kbd>Esc</Kbd>
			</div>
			<div id="cmd-list" role="listbox" aria-label="Results" class="overflow-auto p-1.5">
				{#each commands as c, i (c.group + c.id)}
					{#if i === 0 || commands[i - 1].group !== c.group}
						<div class="px-3 pt-2.5 pb-1.5 eyebrow text-[10px]">{c.group}</div>
					{/if}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						id="cmd-{i}"
						role="option"
						tabindex="-1"
						aria-selected={i === sel}
						onclick={() => run(c)}
						onmousemove={() => (sel = i)}
						class="flex h-10 cursor-pointer items-center gap-3 px-3.5 text-[14px] {i === sel
							? 'bg-sel text-ink'
							: 'text-ink-2'}"
					>
						<span class="text-muted"><Icon name={c.icon} size={15} /></span>
						<span class="flex-1 truncate">{c.label}</span>
						{#if c.hint}<span class="font-mono text-[10.5px] text-muted">{c.hint}</span>{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</dialog>
