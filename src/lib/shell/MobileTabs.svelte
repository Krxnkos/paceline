<script lang="ts">
	import { page } from '$app/state';

	const tabs: { href: string; label: string }[] = [
		{ href: '/today', label: 'Today' },
		{ href: '/week', label: 'Week' },
		{ href: '/board', label: 'Board' },
		{ href: '/insights', label: 'Insights' }
	];
</script>

<nav
	aria-label="Tabs"
	class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-canvas pb-[max(10px,env(safe-area-inset-bottom))] nav:hidden"
>
	{#each tabs as t (t.href)}
		{@const on = page.url.pathname.startsWith(t.href)}
		<a
			href={t.href}
			aria-current={on ? 'page' : undefined}
			class="-mt-px flex h-[58px] flex-col items-center justify-center gap-1 border-t-2 font-mono text-[10px] tracking-[0.1em] uppercase {on
				? 'border-accent text-ink'
				: 'border-transparent text-muted'}"
		>
			<span class="block size-1.5 {on ? 'bg-accent' : 'bg-line-3'}"></span>{t.label}
		</a>
	{/each}
</nav>
