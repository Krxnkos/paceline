<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '../ui/Icon.svelte';
	import Mark from '../ui/Mark.svelte';
	import Avatar from '../ui/Avatar.svelte';
	import PlanBadge from '../ui/PlanBadge.svelte';
	import { CONSOLE_NAV, NAV, SETTINGS_NAV, type NavEntry } from './nav.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { auth, shortName } from '../stores/auth.svelte.ts';
	import { theme, THEMES } from '../stores/theme.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { mustDos } from '../domain/forecast.ts';

	let menuOpen = $state(false);

	const counts = $derived.by(() => {
		const left = mustDos(workspace.tasks, workspace.plan, clock.today)
			.slice(0, 3)
			.filter((t) => t.status !== 'done').length;
		return { '/today': left, '/inbox': workspace.inboxCount } as Record<string, number>;
	});
	const hot = $derived(workspace.alerts.some((a) => a.tone === 'late'));

	const current = (n: NavEntry) =>
		page.url.pathname === n.href || page.url.pathname.startsWith(n.href + '/');
	const syncLabel = $derived(
		workspace.saving === 'offline'
			? 'Offline · will sync'
			: workspace.saving === 'saving'
				? 'Saving…'
				: 'Synced · private'
	);

	function cycleTheme() {
		const list =
			workspace.tier.themes === 'all' ? THEMES.map((t) => t.id) : (['carbon', 'chalk'] as const);
		const next = list[(list.findIndex((t) => t === theme.resolved) + 1) % list.length];
		theme.set(next);
		workspace.updateSettings({ theme: next });
	}

	async function signOut() {
		menuOpen = false;
		await auth.signOut();
		workspace.unload();
		await goto('/login');
	}
</script>

{#snippet item(n: NavEntry)}
	{@const on = current(n)}
	<a
		href={n.href}
		aria-current={on ? 'page' : undefined}
		class="relative flex h-10 items-center gap-3 pr-3 pl-3.5 text-[14px] font-semibold transition-colors {on
			? 'border-l-2 border-accent bg-surface pl-3 text-ink'
			: 'text-ink-3 hover:bg-surface hover:text-ink'}"
	>
		<span class={on ? 'text-accent-text' : ''}><Icon name={n.icon} /></span>
		{n.label}
		{#if counts[n.href]}
			<span
				class="ml-auto font-mono text-[11px] {on || (n.href === '/today' && hot)
					? 'text-accent-text'
					: 'text-muted'}">{counts[n.href]}</span
			>
		{/if}
	</a>
{/snippet}

<nav
	aria-label="Main"
	class="flex h-full flex-col gap-5 overflow-y-auto border-r border-line bg-canvas px-3.5 pt-5 pb-3.5"
>
	<a href="/today" class="flex items-center gap-2.5 px-2" aria-label="Paceline — Today">
		<Mark width={38} />
		<span class="text-[19px] display">PACELINE</span>
	</a>

	{#each NAV as g (g.group)}
		<div class="flex flex-col gap-0.5">
			<span class="mb-1 px-3.5 eyebrow text-[10px]">{g.group}</span>
			{#each g.items as n (n.href)}{@render item(n)}{/each}
		</div>
	{/each}

	<div class="mt-auto flex flex-col gap-0.5 border-t border-line pt-3.5">
		{#if auth.user?.developer}{@render item(CONSOLE_NAV)}{/if}
		{@render item(SETTINGS_NAV)}
		<div class="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
				class="flex min-h-[52px] w-full items-center gap-3 py-1.5 pr-3 pl-3.5 text-left hover:bg-surface"
			>
				<Avatar name={auth.user?.name ?? '?'} />
				<span class="flex min-w-0 flex-col">
					<span class="truncate text-[14px] font-semibold text-ink"
						>{auth.user?.username
							? `@${auth.user.username}`
							: shortName(auth.user?.name ?? '')}</span
					>
					<span class="font-mono text-[10px] tracking-[0.08em] text-muted uppercase"
						>{syncLabel}</span
					>
					<span class="mt-1 flex flex-wrap gap-1">
						<PlanBadge kind={auth.user?.tier ?? 'free'} />
						{#if auth.user?.developer}<PlanBadge kind="developer" />{/if}
					</span>
				</span>
				<span class="ml-auto text-muted"><Icon name="chevronDown" size={14} /></span>
			</button>
			{#if menuOpen}
				<div
					role="menu"
					tabindex="-1"
					class="absolute right-0 bottom-full left-0 z-70 mb-1 animate-pop border border-line-3 bg-raised p-1"
					onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
				>
					<div class="border-b border-line px-2.5 pt-1.5 pb-2.5">
						<div class="text-[13px] font-semibold">{auth.user?.name}</div>
						<div class="truncate font-mono text-[10.5px] text-muted">{auth.user?.email}</div>
					</div>
					<button role="menuitem" class="menu-item" onclick={cycleTheme}>
						<Icon name="sun" size={14} />Theme<span
							class="ml-auto font-mono text-[10.5px] text-muted uppercase">{theme.resolved}</span
						>
					</button>
					<button
						role="menuitem"
						class="menu-item"
						onclick={() => {
							menuOpen = false;
							ui.shortcuts = true;
						}}
						><Icon name="keyboard" size={14} />Keyboard shortcuts<span
							class="ml-auto font-mono text-[10.5px] text-muted">?</span
						></button
					>
					<button role="menuitem" class="menu-item" onclick={signOut}
						><Icon name="logout" size={14} />Sign out</button
					>
				</div>
			{/if}
		</div>
	</div>
</nav>

<svelte:window
	onclick={(e) => {
		if (menuOpen && !(e.target as HTMLElement).closest('[aria-haspopup="menu"], [role="menu"]'))
			menuOpen = false;
	}}
/>

<style>
	.menu-item {
		display: flex;
		width: 100%;
		height: 2.25rem;
		align-items: center;
		gap: 0.625rem;
		padding: 0 0.625rem;
		font-size: 13px;
		color: var(--ink-2);
		text-align: left;
	}
	.menu-item:hover,
	.menu-item:focus-visible {
		background: var(--sel);
		color: var(--ink);
	}
</style>
