<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '../ui/Icon.svelte';
	import Kbd from '../ui/Kbd.svelte';
	import Badge from '../ui/Badge.svelte';
	import { navFor } from './nav.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import type { Alert } from '../types.ts';

	const nav = $derived(navFor(page.url.pathname));
	const title = $derived(
		page.url.pathname === '/onboarding' ? 'Welcome' : (nav?.label ?? 'Paceline')
	);
	let bellOpen = $state(false);
	const hot = $derived(workspace.alerts.some((a) => a.tone === 'late'));

	function openAlert(a: Alert) {
		bellOpen = false;
		if (a.taskId) openTask(a.taskId);
		else if (a.view) goto(a.view);
	}
</script>

<header
	class="sticky top-0 z-30 flex h-14 flex-none items-center gap-2.5 border-b border-line bg-canvas pr-3 pl-3 nav:pr-5 nav:pl-7"
>
	<button
		type="button"
		class="inline-flex size-10 items-center justify-center text-ink-3 hover:bg-hover hover:text-ink nav:hidden"
		aria-label="Open navigation"
		onclick={() => (ui.sidebarOpen = true)}><Icon name="menu" size={18} /></button
	>
	<div class="flex min-w-0 items-baseline gap-3">
		{#if nav}<span class="hidden font-mono text-[11px] tracking-[0.12em] text-accent-text sm:inline"
				>{nav.index}</span
			>{/if}
		<span class="truncate text-base font-bold wide">{title}</span>
		{#if nav}<span class="hidden truncate text-[13px] text-muted wide:inline">{nav.sub}</span>{/if}
	</div>

	<div class="ml-auto flex items-center gap-2">
		{#if focus.state}
			<button
				type="button"
				onclick={() => (ui.focusOpen = true)}
				class="inline-flex h-9 items-center gap-2 border px-2.5 font-mono text-[13px] font-medium {focus
					.state.phase === 'break'
					? 'border-ice text-ice'
					: 'border-line-3 text-ink'}"
				aria-label="Open focus timer, {focus.clock} left"
			>
				<span
					class="size-2 {focus.state.phase === 'break' ? 'bg-ice' : 'bg-accent'} {focus.running
						? 'animate-blink'
						: ''}"
				></span>
				{focus.state.phase === 'break' ? 'BREAK ' : ''}{focus.clock}
			</button>
		{/if}

		<div class="relative">
			<button
				type="button"
				aria-haspopup="true"
				aria-expanded={bellOpen}
				onclick={() => (bellOpen = !bellOpen)}
				class="relative inline-flex size-9 items-center justify-center text-ink-3 hover:bg-hover hover:text-ink"
				aria-label="Heads-up, {workspace.alerts.length} items"
			>
				<Icon name="bell" />
				{#if hot}<span class="absolute top-2 right-2 size-[7px] bg-flare"></span>{/if}
			</button>
			{#if bellOpen}
				<div
					class="absolute top-full right-0 z-70 mt-1 w-[min(360px,calc(100vw-24px))] animate-pop border border-line-3 bg-raised"
				>
					<div class="flex justify-between border-b border-line px-4 py-3">
						<span class="eyebrow">Heads-up · {workspace.alerts.length}</span>
					</div>
					{#each workspace.alerts.slice(0, 8) as a, i (i)}
						<button
							type="button"
							class="flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left hover:bg-sel"
							onclick={() => openAlert(a)}
						>
							<Badge tone={a.tone} label={a.label} />
							<span class="text-[13.5px] font-semibold text-ink">{a.text}</span>
							{#if a.sub}<span class="text-xs text-muted">{a.sub}</span>{/if}
						</button>
					{:else}
						<p class="m-0 px-4 py-6 text-center text-sm text-muted">
							All clear. Nothing needs you right now.
						</p>
					{/each}
				</div>
			{/if}
		</div>

		<button
			type="button"
			onclick={() => (ui.palette = true)}
			class="hidden h-9 items-center gap-2.5 border border-line-2 pr-2 pl-3 text-[13px] text-muted hover:border-line-3 hover:text-ink sm:inline-flex"
		>
			<Icon name="search" size={14} />Search<Kbd>⌘K</Kbd>
		</button>
		<button
			type="button"
			onclick={() => (ui.palette = true)}
			class="inline-flex size-9 items-center justify-center text-ink-3 hover:bg-hover sm:hidden"
			aria-label="Search"
		>
			<Icon name="search" />
		</button>
		<button
			type="button"
			onclick={() => ui.openNewTask()}
			class="inline-flex h-9 items-center gap-2 border border-line-2 pr-2 pl-1.5 text-[13px] font-semibold text-ink-2 hover:border-line-3 hover:text-ink"
		>
			<span class="inline-flex size-5 items-center justify-center bg-accent text-accent-ink"
				><Icon name="plus" size={13} stroke={2.6} /></span
			>
			<span class="hidden sm:inline">New task</span><span class="hidden sm:inline"
				><Kbd>N</Kbd></span
			>
		</button>
	</div>
</header>

<svelte:window
	onclick={(e) => {
		if (bellOpen && !(e.target as HTMLElement).closest('[aria-haspopup="true"], .z-70'))
			bellOpen = false;
	}}
	onkeydown={(e) => e.key === 'Escape' && (bellOpen = false)}
/>
