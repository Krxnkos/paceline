<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Drawer from '../ui/Drawer.svelte';
	import Badge from '../ui/Badge.svelte';
	import Button from '../ui/Button.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import Icon from '../ui/Icon.svelte';
	import ProgressBar from '../ui/ProgressBar.svelte';
	import Select from '../ui/Select.svelte';
	import TaskFields from './TaskFields.svelte';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { blockers, code, forecast, urgency } from '../domain/forecast.ts';
	import { fmtDur, fmtShort, minToHM } from '../domain/dates.ts';
	import { input, label } from '../ui/styles.ts';
	import type { Task } from '../types.ts';

	const param = $derived(page.url.searchParams.get('task'));
	const task = $derived.by(() => {
		const m = /^T-(\d+)$/i.exec(param ?? '');
		return m ? workspace.taskByCode(Number(m[1])) : undefined;
	});
	// Open while the URL names a task; closing writes false until the URL catches up.
	let open = $derived(!!task);

	function close() {
		if (!page.url.searchParams.has('task')) return;
		const url = new URL(page.url.href);
		url.searchParams.delete('task');
		goto(url, { reset: false, replace: true });
	}

	// A plain copy for the property grid; edits go through the store.
	const draft = $derived(task ? ({ ...$state.snapshot(task) } as Task) : null);
	const placement = $derived(task ? workspace.plan.placed[task.id] : null);
	const urg = $derived(task ? urgency(task, clock.today) : null);
	const fc = $derived(task ? forecast(task, workspace.plan, workspace.tasks) : null);
	const waits = $derived(task ? blockers(task, workspace.tasks) : []);

	let newSub = $state('');
	let logMin = $state(15);
	let depPick = $state('');

	const depOptions = $derived(
		task
			? [
					{ value: '', label: '+ Add a dependency…' },
					...workspace.tasks
						.filter((t) => t.id !== task.id && !task.deps.includes(t.id) && t.status !== 'done')
						.map((t) => ({ value: t.id, label: `${code(t.code)} · ${t.title}` }))
				]
			: []
	);
</script>

<Drawer bind:open label="Task details" onclose={close}>
	{#snippet head()}
		{#if task}
			<span class="font-mono text-[12px] text-faint">{code(task.code)}</span>
			{#if task.status === 'done'}<Badge tone="lead" label="Done" />{/if}
		{/if}
	{/snippet}

	{#if task && draft}
		<div class="flex flex-col gap-6">
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap gap-3">
					{#if urg && task.status !== 'done'}<Badge tone={urg.tone} label={urg.label} />{/if}
					{#if fc}<Badge tone={fc.tone} label={fc.label} />{/if}
					{#if task.quick}<Badge tone="mute" label="Quick win" />{/if}
					{#if task.inbox}<Badge tone="info" label="In inbox" />{/if}
				</div>
				<textarea
					rows="2"
					value={task.title}
					aria-label="Title"
					class="w-full resize-none bg-transparent text-[22px] leading-tight font-extrabold text-ink wide focus:outline-none"
					onblur={(e) => {
						const v = e.currentTarget.value.trim();
						if (v && v !== task.title) workspace.updateTask(task.id, { title: v });
					}}></textarea>
				{#if task.inbox}
					<Button
						size="sm"
						variant="secondary"
						iconRight="arrowRight"
						onclick={() => workspace.updateTask(task.id, { inbox: false })}
						>Move out of Inbox into the plan</Button
					>
				{/if}
			</div>

			<TaskFields task={draft} onchange={(patch) => workspace.updateTask(task.id, patch)} />

			<section class="flex flex-col gap-2.5">
				<span class={label}>Depends on</span>
				{#each task.deps as id (id)}
					{@const d = workspace.task(id)}
					{#if d}
						<div class="flex items-center gap-2.5 border-b border-line py-1.5 text-[13.5px]">
							<span class="font-mono text-[11px] text-faint">{code(d.code)}</span>
							<span class="flex-1 truncate {d.status === 'done' ? 'text-muted line-through' : ''}"
								>{d.title}</span
							>
							<button
								type="button"
								class="text-muted hover:text-flare"
								aria-label="Remove dependency on {d.title}"
								onclick={() =>
									workspace.updateTask(task.id, { deps: task.deps.filter((x) => x !== id) })}
								><Icon name="x" size={14} /></button
							>
						</div>
					{/if}
				{/each}
				{#if waits.length}
					<span class="font-mono text-[10.5px] text-flare uppercase"
						>Blocked · waits on {waits.map((w) => code(w.code)).join(', ')}</span
					>
				{/if}
				<Select
					bind:value={depPick}
					options={depOptions}
					aria-label="Add dependency"
					onchange={() => {
						if (depPick) workspace.updateTask(task.id, { deps: [...task.deps, depPick] });
						depPick = '';
					}}
				/>
			</section>

			<section class="flex flex-col gap-2">
				<span class={label}>Schedule</span>
				{#if placement}
					<span class="text-[13.5px] text-ink-2"
						>{fmtDur(placement.blocks.reduce((n, b) => n + b.end - b.start, 0))} booked</span
					>
					{#each placement.blocks.slice(0, 6) as b (b.date + b.start)}
						<div class="flex justify-between border-b border-line py-1.5 font-mono text-[12px]">
							<span class="text-muted">{fmtShort(b.date)}</span><span
								>{minToHM(b.start)}–{minToHM(b.end)}</span
							>
						</div>
					{/each}
					{#if placement.blocks.length > 6}<span class="font-mono text-[11px] text-muted"
							>+{placement.blocks.length - 6} more blocks</span
						>{/if}
				{:else}
					<span class="text-[13.5px] text-muted">
						{task.status === 'done'
							? `Done ${task.doneAt ? fmtShort(task.doneAt) : ''}`
							: task.quick
								? 'Quick wins are never auto-scheduled. Pick them on Today.'
								: task.inbox
									? 'Triage it out of the Inbox to plan it.'
									: task.start === 'manual'
										? 'Manual: the planner leaves this one to you.'
										: waits.length
											? 'Blocked until its dependencies are done.'
											: 'No room in the next 120 days.'}
					</span>
				{/if}
			</section>

			<section class="flex flex-col gap-2">
				<span class="{label} flex justify-between"
					>Subtasks<span>{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}</span
					></span
				>
				{#each task.subtasks as s (s.id)}
					<div class="group flex items-center gap-3 border-b border-line py-2">
						<Checkbox
							checked={s.done}
							label={s.title}
							size={18}
							onchange={() => workspace.toggleSubtask(task.id, s.id)}
						/>
						<span class="flex-1 text-[14px] {s.done ? 'text-muted line-through' : ''}"
							>{s.title}</span
						>
						<button
							type="button"
							class="text-faint opacity-0 group-hover:opacity-100 hover:text-flare focus:opacity-100"
							aria-label="Remove subtask"
							onclick={() => workspace.removeSubtask(task.id, s.id)}
							><Icon name="x" size={14} /></button
						>
					</div>
				{/each}
				<form
					class="flex gap-2"
					onsubmit={(e) => {
						e.preventDefault();
						if (newSub.trim()) workspace.addSubtask(task.id, newSub.trim());
						newSub = '';
					}}
				>
					<input
						bind:value={newSub}
						placeholder="Add a subtask"
						class={input}
						aria-label="New subtask"
					/>
					<Button type="submit" size="md" icon="plus" iconOnly aria-label="Add subtask"></Button>
				</form>
			</section>

			<section class="flex flex-col gap-2">
				<span class={label}>Notes</span>
				<textarea
					rows="4"
					value={task.notes ?? ''}
					placeholder="Context, links, decisions…"
					aria-label="Notes"
					class="{input} h-auto min-h-22 resize-y py-2 leading-normal"
					onblur={(e) => {
						if (e.currentTarget.value !== (task.notes ?? ''))
							workspace.updateTask(task.id, { notes: e.currentTarget.value });
					}}></textarea>
			</section>

			<section class="flex flex-col gap-2.5">
				<span class="{label} flex justify-between"
					>Time<span>{fmtDur(task.loggedMin)} of {fmtDur(task.estimateMin)}</span></span
				>
				<ProgressBar
					value={task.estimateMin ? task.loggedMin / task.estimateMin : 0}
					tone={task.loggedMin > task.estimateMin ? 'late' : 'ink'}
				/>
				<div class="flex flex-wrap items-center gap-2">
					<input
						type="number"
						min="1"
						step="5"
						bind:value={logMin}
						class="{input} w-24 font-mono"
						aria-label="Minutes to log"
					/>
					<Button size="md" onclick={() => workspace.logTime(task.id, Number(logMin) || 0)}
						>Log minutes</Button
					>
					<Button
						size="md"
						icon="focus"
						onclick={() => {
							focus.start(task.id);
							ui.focusOpen = true;
						}}>Start focus</Button
					>
				</div>
				{#each [...task.log].reverse().slice(0, 5) as l (l.date)}
					<div class="flex justify-between border-b border-line py-1.5 font-mono text-[12px]">
						<span class="text-muted">{fmtShort(l.date)}</span><span>{fmtDur(l.minutes)}</span>
					</div>
				{/each}
			</section>
		</div>
	{/if}

	{#snippet footer()}
		{#if task}
			<Button
				variant="danger"
				icon="trash"
				onclick={() => {
					const id = task.id;
					close();
					workspace.deleteTask(id);
				}}>Delete</Button
			>
			<Button
				variant={task.status === 'done' ? 'secondary' : 'primary'}
				icon="check"
				onclick={() => workspace.complete(task.id)}
				>{task.status === 'done' ? 'Reopen' : 'Complete'}</Button
			>
		{/if}
	{/snippet}
</Drawer>
