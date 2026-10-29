<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import HealthBadge from '#lib/ui/HealthBadge.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { goalProgress } from '#lib/domain/stats.ts';
	import { diffDays, fmtShort } from '#lib/domain/dates.ts';

	const rows = $derived(
		workspace.goals
			.map((g) => ({
				g,
				pr: goalProgress(g, workspace.tasks, workspace.projects, workspace.plan, clock.today)
			}))
			.sort((a, b) => a.g.due.localeCompare(b.g.due))
	);
	const behind = $derived(
		rows.filter((r) => r.pr.pace === 'Behind' || r.pr.pace === 'Slightly behind').length
	);
	const sourceLabel = (g: (typeof rows)[number]['g']) =>
		g.source === 'logged'
			? `Tracks ${g.category} hours`
			: g.source === 'project'
				? `Tracks ${workspace.project(g.projectId)?.name ?? 'a project'}`
				: 'Updated by you';
</script>

<svelte:head><title>Paceline · Goals</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-12 nav:px-8">
	<PageHead index="09" eyebrow="Goals · {rows.length} · {behind} behind" title="Hold the line.">
		{#snippet actions()}
			<Button size="lg" variant="primary" icon="plus" onclick={() => ui.openGoal()}>New goal</Button
			>
		{/snippet}
	</PageHead>

	<div class="grid gap-4 wide:grid-cols-2">
		{#each rows as { g, pr } (g.id)}
			{@const span = Math.max(1, diffDays(g.due, g.start))}
			{@const elapsed = Math.min(1, Math.max(0, diffDays(clock.today, g.start) / span))}
			<article class="flex flex-col gap-4 border border-line p-5">
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 flex-col gap-1">
						<span class="eyebrow">{sourceLabel(g)}</span>
						<h2 class="m-0 text-lg leading-tight font-extrabold wide">{g.title}</h2>
						{#if g.why}<p class="m-0 text-[13.5px] text-muted">{g.why}</p>{/if}
					</div>
					<button
						type="button"
						aria-label="Edit {g.title}"
						class="inline-flex size-9 flex-none items-center justify-center text-muted hover:bg-hover hover:text-ink"
						onclick={() => ui.openGoal(g)}><Icon name="edit" /></button
					>
				</div>
				<div class="flex items-end justify-between gap-3">
					<span class="text-[40px] heavy leading-none"
						>{pr.current}<span class="text-lg text-muted"> / {g.target} {g.unit}</span></span
					>
					<HealthBadge label={pr.pace} />
				</div>
				<div class="relative">
					<ProgressBar
						value={pr.pct}
						height={6}
						tone={pr.pace === 'Behind' || pr.pace === 'Missed'
							? 'late'
							: pr.pace === 'Achieved' || pr.pace === 'Ahead'
								? 'lead'
								: 'ink'}
						label="{g.title} progress"
					/>
					<span
						class="absolute -top-1 h-3.5 w-0.5 bg-ink-3"
						style="left: {elapsed * 100}%"
						title="Where a straight line says you should be"
					></span>
				</div>
				<div
					class="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase"
				>
					<span
						>Deadline {fmtShort(g.due)} · {pr.daysLeft >= 0
							? `${pr.daysLeft} day${pr.daysLeft === 1 ? '' : 's'} left`
							: 'passed'}</span
					>
					{#if g.source === 'manual'}
						<span class="flex gap-1.5">
							<Button
								size="xs"
								onclick={() => workspace.updateGoal(g.id, { current: Math.max(0, g.current - 1) })}
								aria-label="Decrease">−1</Button
							>
							<Button
								size="xs"
								onclick={() => workspace.updateGoal(g.id, { current: g.current + 1 })}
								aria-label="Increase">+1</Button
							>
						</span>
					{/if}
				</div>
			</article>
		{:else}
			<div class="wide:col-span-2">
				<EmptyState
					title="No goals yet"
					body="Set a target and a deadline. Paceline compares your pace to a straight line from start to finish."
				>
					{#snippet action()}<Button icon="plus" onclick={() => ui.openGoal()}>New goal</Button
						>{/snippet}
				</EmptyState>
			</div>
		{/each}
	</div>
</div>
