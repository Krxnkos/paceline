<script lang="ts">
	import FilterBar from '#lib/shell/FilterBar.svelte';
	import Badge from '#lib/ui/Badge.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import { workspace, openTask } from '#lib/stores/workspace.svelte.ts';
	import { filters } from '#lib/stores/filters.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import { code, forecast, urgency } from '#lib/domain/forecast.ts';
	import { score } from '#lib/domain/plan.ts';
	import { fmtDur } from '#lib/domain/dates.ts';
	import type { Status, Task } from '#lib/types.ts';

	type Key =
		'code' | 'title' | 'status' | 'priority' | 'due' | 'forecast' | 'project' | 'estimate' | 'rank';
	type Group = 'none' | 'status' | 'project' | 'category' | 'urgency';

	let sortKey = $state<Key>('rank');
	let dir = $state<1 | -1>(1);
	let group = $state<Group>('status');
	let selected = $state<string[]>([]);

	const statusOrder = $derived(Object.fromEntries(workspace.columns.map((s, i) => [s.id, i])));
	const projName = (t: Task) => workspace.project(t.projectId)?.name ?? '';
	const fcEnd = (t: Task) =>
		workspace.plan.placed[t.id]?.endDate ?? (t.status === 'done' ? '0' : '9999');

	const rows = $derived.by(() => {
		const list = workspace.tasks.filter(filters.match);
		const val = (t: Task): string | number => {
			switch (sortKey) {
				case 'code':
					return t.code;
				case 'title':
					return t.title.toLowerCase();
				case 'status':
					return statusOrder[t.status];
				case 'priority':
					return t.priority;
				case 'due':
					return t.due ?? '9999';
				case 'forecast':
					return fcEnd(t);
				case 'project':
					return projName(t) || '~';
				case 'estimate':
					return t.estimateMin;
				case 'rank':
					return t.status === 'done' ? 1e9 : -score(t, clock.today);
			}
		};
		return [...list].sort((a, b) => {
			const x = val(a);
			const y = val(b);
			return (x < y ? -1 : x > y ? 1 : 0) * dir;
		});
	});

	const groups = $derived.by(() => {
		if (group === 'none') return [{ key: 'all', label: 'All tasks', rows }];
		const keyOf = (t: Task): [string, string] => {
			if (group === 'status')
				return [
					String(statusOrder[t.status]),
					workspace.columns.find((s) => s.id === t.status)?.label ?? 'Other'
				];
			if (group === 'project') return [projName(t) || '~', projName(t) || 'No project'];
			if (group === 'category') return [t.category, t.category];
			const u = urgency(t, clock.today);
			const order = ['overdue', 'today', 'soon', 'week', 'later', 'future', 'none', 'done'];
			return [String(order.indexOf(u.key)), u.label];
		};
		const map: Record<string, { key: string; label: string; rows: Task[] }> = {};
		for (const t of rows) {
			const [k, label] = keyOf(t);
			(map[k] ??= { key: k, label, rows: [] }).rows.push(t);
		}
		return Object.values(map).sort((a, b) => (a.key < b.key ? -1 : 1));
	});

	function sortBy(k: Key) {
		if (sortKey === k) dir = dir === 1 ? -1 : 1;
		else {
			sortKey = k;
			dir = 1;
		}
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.includes(r.id)));
	const sel = $derived(selected.filter((id) => workspace.task(id)));

	const cols: { key: Key; label: string; cls?: string }[] = [
		{ key: 'code', label: 'ID', cls: 'w-20' },
		{ key: 'title', label: 'Task', cls: 'min-w-[300px]' },
		{ key: 'status', label: 'Status', cls: 'w-36' },
		{ key: 'priority', label: 'Pri', cls: 'w-24' },
		{ key: 'due', label: 'Due', cls: 'w-36' },
		{ key: 'forecast', label: 'Forecast', cls: 'w-32' },
		{ key: 'project', label: 'Project', cls: 'w-44' },
		{ key: 'estimate', label: 'Est', cls: 'w-20' }
	];
	const cell =
		'h-8 w-full rounded-xs border border-transparent bg-transparent px-2 text-[13px] text-ink hover:border-line-2 focus:border-ink-3 focus:bg-surface focus:outline-none';
	const inline =
		'[&_select]:h-8 [&_select]:border-transparent [&_select]:bg-transparent [&_select]:text-[13px] [&_select:hover]:border-line-2';
</script>

<svelte:head><title>Paceline · Table</title></svelte:head>

<div class="flex flex-col px-4 pt-2 pb-24 nav:px-8">
	<FilterBar count="{rows.length} tasks">
		<Select
			bind:value={group}
			aria-label="Group by"
			class="w-44 [&_select]:h-9 [&_select]:text-[13px]"
			options={[
				{ value: 'none', label: 'No grouping' },
				{ value: 'status', label: 'Group: status' },
				{ value: 'project', label: 'Group: project' },
				{ value: 'category', label: 'Group: category' },
				{ value: 'urgency', label: 'Group: urgency' }
			]}
		/>
	</FilterBar>

	<div class="overflow-x-auto">
		<table class="w-full min-w-[1240px] border-collapse text-[13.5px]">
			<thead>
				<tr>
					<th class="sticky top-0 z-10 h-[38px] w-10 border-b border-line bg-canvas px-2 text-left">
						<Checkbox
							checked={allSelected}
							size={16}
							label="Select all"
							onchange={() => (selected = allSelected ? [] : rows.map((r) => r.id))}
						/>
					</th>
					{#each cols as c (c.key)}
						<th
							class="sticky top-0 z-10 h-[38px] border-b border-line bg-canvas px-2 text-left {c.cls ??
								''}"
							aria-sort={sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
						>
							<button
								type="button"
								class="inline-flex items-center gap-1 eyebrow hover:text-ink"
								onclick={() => sortBy(c.key)}
							>
								{c.label}{#if sortKey === c.key}<span class="text-accent-text"
										>{dir === 1 ? '↑' : '↓'}</span
									>{/if}
							</button>
						</th>
					{/each}
					<th class="sticky top-0 z-10 w-10 border-b border-line bg-canvas"
						><span class="sr-only">Open</span></th
					>
				</tr>
			</thead>
			<tbody>
				{#each groups as g (g.key)}
					{#if group !== 'none'}
						<tr>
							<td colspan={cols.length + 2} class="h-9 border-b border-line bg-panel px-3">
								<span class="eyebrow"
									><b class="font-medium text-ink-2">{g.label}</b> · {g.rows.length} · {fmtDur(
										g.rows.reduce((n, t) => n + (t.status === 'done' ? 0 : t.estimateMin), 0)
									)}</span
								>
							</td>
						</tr>
					{/if}
					{#each g.rows as t (t.id)}
						{@const f = forecast(t, workspace.plan, workspace.tasks)}
						{@const u = urgency(t, clock.today)}
						<tr
							class="h-11 border-b border-line {selected.includes(t.id)
								? 'bg-accent/10'
								: 'hover:bg-hover/50'}"
						>
							<td class="px-2"
								><Checkbox
									checked={selected.includes(t.id)}
									size={16}
									label="Select {t.title}"
									onchange={() => toggle(t.id)}
								/></td
							>
							<td class="px-2 font-mono text-xs text-faint">{code(t.code)}</td>
							<td class="px-1">
								<input
									value={t.title}
									aria-label="Title"
									class="{cell} font-semibold {t.status === 'done'
										? 'text-muted line-through'
										: ''}"
									onkeydown={(e) => {
										if (e.key === 'Enter') e.currentTarget.blur();
										if (e.key === 'Escape') {
											e.currentTarget.value = t.title;
											e.currentTarget.blur();
										}
									}}
									onblur={(e) => {
										const v = e.currentTarget.value.trim();
										if (v && v !== t.title) workspace.updateTask(t.id, { title: v });
										else e.currentTarget.value = t.title;
									}}
								/>
							</td>
							<td class="px-1">
								<Select
									value={t.status}
									options={workspace.columns.map((s) => ({ value: s.id, label: s.label }))}
									aria-label="Status"
									class={inline}
									onchange={(e) => workspace.setStatus(t.id, e.currentTarget.value as Status)}
								/>
							</td>
							<td class="px-1">
								<Select
									value={t.priority}
									options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: `P${p}` }))}
									aria-label="Priority"
									class="{inline} [&_select]:font-mono"
									onchange={(e) =>
										workspace.updateTask(t.id, {
											priority: Number(e.currentTarget.value) as Task['priority']
										})}
								/>
							</td>
							<td class="px-1">
								<span class="flex items-center gap-1.5">
									<input
										type="date"
										value={t.due ?? ''}
										aria-label="Due"
										class="{cell} font-mono text-xs {u.tone === 'late' && t.status !== 'done'
											? 'text-flare'
											: ''}"
										onchange={(e) =>
											workspace.updateTask(t.id, { due: e.currentTarget.value || null })}
									/>
								</span>
							</td>
							<td class="px-2"
								>{#if f}<Badge tone={f.tone} label={f.label} />{/if}</td
							>
							<td class="truncate px-2 text-[13px] text-ink-3">{projName(t) || '—'}</td>
							<td class="px-2 font-mono text-xs text-ink-3">{fmtDur(t.estimateMin)}</td>
							<td class="px-1">
								<button
									type="button"
									aria-label="Open {t.title}"
									class="inline-flex size-8 items-center justify-center text-muted hover:bg-hover hover:text-ink"
									onclick={() => openTask(t.id)}><Icon name="arrowRight" size={14} /></button
								>
							</td>
						</tr>
					{/each}
				{:else}
					<tr
						><td colspan={cols.length + 2} class="py-12 text-center text-sm text-muted"
							>No tasks match these filters.</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</div>

	{#if sel.length}
		<div
			class="sticky bottom-4 z-20 mt-4 flex animate-pop flex-wrap items-center gap-2.5 self-start bg-ink px-4 py-2.5 text-canvas"
		>
			<span class="mr-2 font-mono text-[11px] tracking-[0.1em] uppercase"
				>{sel.length} selected</span
			>
			<button
				type="button"
				class="bulk"
				onclick={() => {
					workspace.updateMany(sel, { status: 'done' });
					toast(`Completed ${sel.length}`, { action: 'Undo', onAction: () => workspace.undo() });
					selected = [];
				}}>Complete</button
			>
			<select
				class="bulk"
				aria-label="Move to"
				onchange={(e) => {
					const v = e.currentTarget.value as Status;
					if (v) {
						workspace.updateMany(sel, { status: v, inbox: false });
						toast(`Moved ${sel.length}`, { action: 'Undo', onAction: () => workspace.undo() });
					}
					e.currentTarget.value = '';
				}}
			>
				<option value="">Move to…</option>
				{#each workspace.columns as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
			</select>
			<select
				class="bulk"
				aria-label="Priority"
				onchange={(e) => {
					const v = Number(e.currentTarget.value);
					if (v) workspace.updateMany(sel, { priority: v as Task['priority'] });
					e.currentTarget.value = '';
				}}
			>
				<option value="">Priority…</option>
				{#each [1, 2, 3, 4, 5] as p (p)}<option value={p}>P{p}</option>{/each}
			</select>
			<span data-theme={theme.pair} class="contents">
				<ConfirmButton
					size="sm"
					label="Delete"
					confirmLabel="Confirm: delete {sel.length}"
					onconfirm={() => {
						workspace.deleteMany(sel);
						toast(`Deleted ${sel.length}`, { action: 'Undo', onAction: () => workspace.undo() });
						selected = [];
					}}
				/>
			</span>
			<button type="button" class="bulk" onclick={() => (selected = [])}>Clear</button>
		</div>
	{/if}
</div>

<style>
	.bulk {
		height: 2rem;
		padding: 0 0.75rem;
		border: 1px solid color-mix(in oklab, var(--canvas) 30%, transparent);
		background: transparent;
		color: var(--canvas);
		font-size: 13px;
		font-weight: 600;
	}
	.bulk:hover {
		background: color-mix(in oklab, var(--canvas) 15%, transparent);
	}
	.bulk option {
		color: var(--ink);
		background: var(--surface);
	}
</style>
