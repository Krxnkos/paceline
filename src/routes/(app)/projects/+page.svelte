<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import HealthBadge from '#lib/ui/HealthBadge.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { projectStats } from '#lib/domain/stats.ts';
	import { fmtHours, fmtShort } from '#lib/domain/dates.ts';

	const rows = $derived(
		workspace.projects
			.map((p) => ({ p, s: projectStats(p, workspace.tasks, workspace.plan) }))
			.sort(
				(a, b) =>
					(a.s.health === 'Complete' ? 1 : 0) - (b.s.health === 'Complete' ? 1 : 0) ||
					(a.p.due ?? '9').localeCompare(b.p.due ?? '9')
			)
	);
	const atRisk = $derived(
		rows.filter((r) => r.s.health === 'At risk' || r.s.health === 'Off track').length
	);
</script>

<svelte:head><title>Paceline · Projects</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-12 nav:px-8">
	<PageHead
		index="08"
		eyebrow="Projects · {rows.length} · {atRisk} at risk"
		title="Who’s at the front."
	>
		{#snippet actions()}
			<Button size="lg" variant="primary" icon="plus" onclick={() => ui.openProject()}
				>New project</Button
			>
		{/snippet}
	</PageHead>

	<div class="overflow-x-auto border-t border-line">
		<div class="min-w-[860px]">
			<div
				class="grid grid-cols-[56px_1.6fr_140px_1fr_100px_110px] gap-5 border-b border-line py-2.5"
			>
				{#each ['ID', 'Project', 'Health', 'Progress', 'Open · left', 'Finish'] as h (h)}<span
						class="eyebrow">{h}</span
					>{/each}
			</div>
			{#each rows as { p, s } (p.id)}
				{@const late = p.due && s.finish && s.finish > p.due}
				<a
					href="/projects/{p.id}"
					class="grid grid-cols-[56px_1.6fr_140px_1fr_100px_110px] items-center gap-5 border-b border-line py-4 hover:bg-hover/50"
				>
					<span class="font-mono text-xs text-faint">P-{String(p.code).padStart(2, '0')}</span>
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="truncate text-[15px] font-bold">{p.name}</span>
						<span class="truncate text-[13px] text-muted">{p.description || 'No description'}</span>
					</span>
					<HealthBadge label={s.health} />
					<span class="flex items-center gap-3">
						<ProgressBar
							value={s.pct}
							tone={s.health === 'Off track' ? 'late' : 'ink'}
							label="{p.name} progress"
						/>
						<span class="w-10 font-mono text-xs">{Math.round(s.pct * 100)}%</span>
					</span>
					<span class="font-mono text-xs text-ink-3">{s.open} · {fmtHours(s.remainingMin)}h</span>
					<span class="flex flex-col font-mono text-xs uppercase">
						<span class={late ? 'text-flare' : ''}>{s.finish ? fmtShort(s.finish) : '—'}</span>
						{#if p.due}<span class="text-[10px] text-muted">target {fmtShort(p.due).slice(4)}</span
							>{/if}
					</span>
				</a>
			{:else}
				<EmptyState
					title="No projects yet"
					body="Group related tasks so Paceline can forecast when the whole thing lands."
				>
					{#snippet action()}<Button onclick={() => ui.openProject()} icon="plus"
							>New project</Button
						>{/snippet}
				</EmptyState>
			{/each}
		</div>
	</div>
</div>
