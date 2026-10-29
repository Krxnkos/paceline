<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Kpi from '#lib/ui/Kpi.svelte';
	import KpiRow from '#lib/ui/KpiRow.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import HealthBadge from '#lib/ui/HealthBadge.svelte';
	import CaptureBar from '#lib/task/CaptureBar.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { projectStats } from '#lib/domain/stats.ts';
	import { code, forecast, urgency } from '#lib/domain/forecast.ts';
	import { fmtDur, fmtHours, fmtShort } from '#lib/domain/dates.ts';
	import { STATUSES } from '#lib/types.ts';

	const project = $derived(workspace.project(page.params.id));
	const stats = $derived(project ? projectStats(project, workspace.tasks, workspace.plan) : null);
	const tasks = $derived(project ? workspace.tasks.filter((t) => t.projectId === project.id) : []);
</script>

<svelte:head><title>Paceline · {project?.name ?? 'Project'}</title></svelte:head>

<div class="flex flex-col gap-6 px-4 pt-7 pb-12 nav:px-8">
	{#if project && stats}
		<PageHead
			index="P-{String(project.code).padStart(2, '0')}"
			eyebrow={project.description || 'Project'}
			title="{project.name}."
		>
			{#snippet actions()}
				<Button size="lg" href="/projects" icon="chevronLeft">All projects</Button>
				<Button size="lg" icon="edit" onclick={() => ui.openProject(project)}>Edit</Button>
				<Button
					size="lg"
					variant="danger"
					icon="trash"
					onclick={() => {
						const id = project.id;
						goto('/projects');
						workspace.deleteProject(id);
					}}>Delete</Button
				>
			{/snippet}
		</PageHead>

		<KpiRow>
			<Kpi value="{Math.round(stats.pct * 100)}%" label="Done by estimate" tone="lead" />
			<Kpi value={String(stats.open).padStart(2, '0')} label="Open tasks" />
			<Kpi value={fmtHours(stats.remainingMin)} unit="h" label="Hours left" />
			<Kpi
				value={stats.finish ? fmtShort(stats.finish).slice(4) : '—'}
				label={project.due
					? `Forecast · target ${fmtShort(project.due).slice(4)}`
					: 'Forecast finish'}
				tone={project.due && stats.finish && stats.finish > project.due ? 'late' : 'ink'}
			/>
		</KpiRow>
		<div class="flex items-center gap-3">
			<span class="eyebrow">Health</span><HealthBadge label={stats.health} />
		</div>

		<CaptureBar
			defaults={{ projectId: project.id }}
			placeholder="Add to {project.name} · @fri 90m !2 #deep"
		/>

		{#each STATUSES as s (s.id)}
			{@const list = tasks.filter((t) => t.status === s.id)}
			{#if list.length}
				<Panel title={s.label} meta={String(list.length).padStart(2, '0')}>
					{#each list as t (t.id)}
						{@const f = forecast(t, workspace.plan, workspace.tasks)}
						{@const u = urgency(t, clock.today)}
						<div
							class="grid grid-cols-[24px_64px_minmax(0,1fr)_auto_auto_64px] items-center gap-3 border-b border-line px-[18px] py-3 last:border-0"
						>
							<Checkbox
								checked={t.status === 'done'}
								size={18}
								label="Complete {t.title}"
								onchange={() => workspace.complete(t.id)}
							/>
							<span class="font-mono text-[11px] text-faint">{code(t.code)}</span>
							<button
								type="button"
								onclick={() => openTask(t.id)}
								class="truncate text-left text-sm font-semibold hover:underline {t.status === 'done'
									? 'text-muted line-through'
									: ''}">{t.title}</button
							>
							<Badge tone={u.tone} label={u.label} />
							{#if f}<Badge tone={f.tone} label={f.label} />{:else}<span></span>{/if}
							<span class="text-right font-mono text-xs text-muted">{fmtDur(t.estimateMin)}</span>
						</div>
					{/each}
				</Panel>
			{/if}
		{:else}
			<span></span>
		{/each}
		{#if !tasks.length}
			<EmptyState
				title="No tasks yet"
				body="Capture the first one above. It inherits this project automatically."
			/>
		{/if}
	{:else}
		<EmptyState title="Project not found" body="It may have been deleted.">
			{#snippet action()}<Button href="/projects">All projects</Button>{/snippet}
		</EmptyState>
	{/if}
</div>
