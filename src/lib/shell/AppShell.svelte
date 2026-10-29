<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Sidebar from './Sidebar.svelte';
	import TopBar from './TopBar.svelte';
	import MobileTabs from './MobileTabs.svelte';
	import CommandPalette from './CommandPalette.svelte';
	import ShortcutsModal from './ShortcutsModal.svelte';
	import TaskDrawer from '../task/TaskDrawer.svelte';
	import NewTaskModal from '../task/NewTaskModal.svelte';
	import MeetingModal from '../task/MeetingModal.svelte';
	import ProjectModal from '../task/ProjectModal.svelte';
	import GoalModal from '../task/GoalModal.svelte';
	import FocusOverlay from '../task/FocusOverlay.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { workspace, setTaskOpener } from '../stores/workspace.svelte.ts';
	import { code } from '../domain/forecast.ts';
	import { ALL_NAV } from './nav.ts';

	let { children }: { children: Snippet } = $props();

	// ?task=T-014 opens the drawer, so a task link is shareable.
	setTaskOpener((id) => {
		const t = workspace.task(id);
		if (!t) return;
		const url = new URL(page.url.href);
		url.searchParams.set('task', code(t.code));
		goto(url, { reset: false });
	});

	afterNavigate(() => (ui.sidebarOpen = false));

	let gPending = false;
	let gTimer: ReturnType<typeof setTimeout> | undefined;

	function typing(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') ui.sidebarOpen = false;
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			ui.palette = !ui.palette;
			return;
		}
		if (typing(e)) return;
		if (mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			workspace.undo();
			return;
		}
		if (mod || e.altKey || document.querySelector('dialog[open]')) return;
		if (gPending) {
			gPending = false;
			const n = ALL_NAV.find((x) => x.key === e.key.toLowerCase());
			if (n) {
				e.preventDefault();
				goto(n.href);
			}
			return;
		}
		switch (e.key) {
			case 'g':
			case 'G':
				gPending = true;
				clearTimeout(gTimer);
				gTimer = setTimeout(() => (gPending = false), 1200);
				break;
			case 'n':
			case 'N':
				e.preventDefault();
				ui.openNewTask();
				break;
			case '/': {
				const el = document.querySelector<HTMLInputElement>('[data-capture], [data-search]');
				if (el) {
					e.preventDefault();
					el.focus();
				}
				break;
			}
			case '[':
				ui.sidebarHidden = !ui.sidebarHidden;
				break;
			case '?':
				ui.shortcuts = true;
				break;
			case 'f':
			case 'F':
				if (!focus.state) focus.start(null);
				ui.focusOpen = true;
				break;
		}
	}
</script>

<svelte:window {onkeydown} />

<div
	class="grid h-dvh grid-cols-1 {ui.sidebarHidden
		? 'nav:grid-cols-[0_minmax(0,1fr)]'
		: 'nav:grid-cols-[232px_minmax(0,1fr)]'}"
>
	<!-- Sidebar: static column on desktop, off-canvas drawer below 860px -->
	<div
		class="fixed inset-y-0 left-0 z-61 w-[280px] transition-transform duration-180 ease-out nav:static nav:z-auto nav:w-auto nav:translate-x-0 nav:overflow-hidden nav:transition-none {ui.sidebarOpen
			? 'translate-x-0'
			: '-translate-x-[102%]'}"
	>
		<Sidebar />
	</div>
	{#if ui.sidebarOpen}
		<button
			type="button"
			class="fixed inset-0 z-60 bg-scrim nav:hidden"
			aria-label="Close navigation"
			onclick={() => (ui.sidebarOpen = false)}
		></button>
	{/if}

	<div class="flex min-h-0 min-w-0 flex-col">
		<TopBar />
		<main id="main" class="min-h-0 flex-1 overflow-auto pb-[96px] nav:pb-0">
			{@render children()}
		</main>
	</div>
</div>

<MobileTabs />
<CommandPalette />
<ShortcutsModal />
<NewTaskModal />
<MeetingModal />
<ProjectModal />
<GoalModal />
<TaskDrawer />
<FocusOverlay />
