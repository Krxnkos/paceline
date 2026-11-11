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
	import Toggle from '../ui/Toggle.svelte';
	import TaskFields from './TaskFields.svelte';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { blockers, code, forecast, quadrantOf, urgency } from '../domain/forecast.ts';
	import { splitDep } from '../domain/plan.ts';
	import { fmtDur, fmtShort, minToHM } from '../domain/dates.ts';
	import { input, label, toneText } from '../ui/styles.ts';
	import type { Quadrant, Task } from '../types.ts';

	const QUAD_LABEL: Record<Quadrant, string> = {
		do: 'Do first',
		schedule: 'Schedule',
		delegate: 'Delegate',
		drop: 'Eliminate'
	};

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
	const explain = $derived(task ? workspace.explain(task) : null);

	/** A dependency id as shown: the task, or the task › sub-task. */
	function depInfo(id: string) {
		const [tid, sid] = splitDep(id);
		const d = workspace.task(tid);
		if (!d) return null;
		const sub = sid ? d.subtasks.find((x) => x.id === sid) : null;
		if (sid && !sub) return null;
		return {
			code: code(d.code),
			title: sub ? `${d.title} › ${sub.title}` : d.title,
			done: sub ? sub.done || d.status === 'done' : d.status === 'done',
			sub: !!sub
		};
	}

	let newSub = $state('');
	let logMin = $state(15);
	let depPick = $state('');
	// "Move to": exact day and time, for when dragging isn't handy.
	let moveDate = $state('');
	let moveTime = $state('');
	$effect(() => {
		const b = placement?.blocks[0];
		moveDate = b?.date ?? clock.today;
		moveTime = b ? minToHM(b.start) : '09:00';
	});

	const depOptions = $derived(
		task
			? [
					{ value: '', label: '+ Add a dependency…' },
					...workspace.tasks
						.filter((t) => t.id !== task.id && t.status !== 'done')
						.flatMap((t) => [
							...(task.deps.includes(t.id)
								? []
								: [{ value: t.id, label: `${code(t.code)} · ${t.title}` }]),
							// Or wait on just one of its sub-tasks.
							...t.subtasks
								.filter((x) => !x.done && !task.deps.includes(`${t.id}:${x.id}`))
								.map((x) => ({
									value: `${t.id}:${x.id}`,
									label: `      ↳ ${code(t.code)} sub-task · ${x.title}`
								}))
						])
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

			<section
				class="flex flex-col gap-2.5 border p-3.5 {explain?.tone === 'late'
					? 'border-flare bg-flare/6'
					: explain?.tone === 'warn'
						? 'border-amber'
						: 'border-line-2 bg-surface'}"
				aria-label="Where it shows up"
			>
				<span class="{label} flex items-center justify-between gap-2"
					>Where it shows up
					{#if workspace.isLocked(task) && task.status !== 'done'}
						<button
							type="button"
							class="font-mono text-[10.5px] tracking-[0.08em] text-ink-3 uppercase underline hover:text-ink"
							onclick={() => workspace.unfix(task.id)}
							>{task.fixed ? 'Moved by hand' : 'Confirmed'} · release</button
						>
					{/if}
				</span>
				{#if explain}
					<p class="m-0 text-[14px] leading-snug {toneText[explain.tone]}">{explain.text}</p>
				{/if}
				{#if placement}
					<div class="flex flex-col">
						{#each placement.blocks.slice(0, 6) as b (b.date + b.start)}
							<div class="flex justify-between border-b border-line py-1.5 font-mono text-[12px]">
								<span class="text-muted">{fmtShort(b.date)}</span><span
									>{minToHM(b.start)}–{minToHM(b.end)} · {fmtDur(b.end - b.start)}</span
								>
							</div>
						{/each}
						{#if placement.blocks.length > 6}<span class="pt-1 font-mono text-[11px] text-muted"
								>+{placement.blocks.length - 6} more blocks</span
							>{/if}
					</div>
				{/if}
				{#if placement && task.status !== 'done' && !workspace.isLocked(task)}
					<Button
						size="sm"
						variant="secondary"
						icon="check"
						onclick={() => workspace.lockIn(task.id)}
						>Confirm {placement.blocks.length === 1 ? 'this time' : 'these times'}</Button
					>
				{/if}
				{#if task.status !== 'done' && !task.inbox && task.start !== 'manual'}
					<form
						class="flex flex-wrap items-end gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							const [h, m] = moveTime.split(':').map(Number);
							if (moveDate && Number.isFinite(h))
								workspace.moveTo(task.id, moveDate, h * 60 + (m || 0));
						}}
					>
						<label
							class="flex flex-col gap-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
							>Move to
							<input
								type="date"
								min={clock.today}
								bind:value={moveDate}
								class="{input} h-9 w-[150px] font-mono text-[13px]"
							/></label
						>
						<input
							type="time"
							step="300"
							bind:value={moveTime}
							aria-label="Start time"
							class="{input} h-9 w-[110px] font-mono text-[13px]"
						/>
						<Button size="sm" type="submit">Move</Button>
					</form>
				{/if}
				{#if task.status !== 'done'}
					<Toggle
						label="Quick win"
						hint={task.quick
							? 'only fills spare time. Turn off to plan it like other work.'
							: 'only fills spare time between other work'}
						checked={!!task.quick}
						onchange={(v) =>
							workspace.updateTask(task.id, v ? { quick: true } : { quick: false, inbox: false })}
					/>
					{#if workspace.settings.dailyMethod === 'frog'}
						<Toggle
							label="Today’s frog"
							hint="planned first thing, before everything else"
							checked={!!task.frog}
							onchange={(v) => workspace.setFrog(v ? task.id : null)}
						/>
					{/if}
				{/if}
			</section>

			{#if task.status !== 'done'}
				<section class="flex flex-col gap-2.5">
					<span class={label}>Park it</span>
					<Toggle
						label="Someday / maybe"
						hint={task.someday ? 'not planned until you bring it back' : 'keep it, but not now'}
						checked={!!task.someday}
						onchange={(v) => workspace.setSomeday(task.id, v)}
					/>
					<label class="flex items-center gap-2 text-[14px] text-ink-2">
						<span class="w-[118px] flex-none">Waiting for</span>
						<input
							value={task.waiting ?? ''}
							maxlength="60"
							placeholder="Who or what (e.g. Sam’s reply)"
							class="{input} h-9 text-[13.5px]"
							onchange={(e) => workspace.setWaiting(task.id, e.currentTarget.value)}
						/>
					</label>
					<label class="flex items-center gap-2 text-[14px] text-ink-2">
						<span class="w-[118px] flex-none">Matrix square</span>
						<Select
							value={task.quadrant ?? ''}
							aria-label="Eisenhower quadrant"
							options={[
								{
									value: '',
									label: `Automatic (${QUAD_LABEL[quadrantOf(task, clock.today, workspace.settings.urgentDays ?? 2)]})`
								},
								{ value: 'do', label: 'Do first' },
								{ value: 'schedule', label: 'Schedule' },
								{ value: 'delegate', label: 'Delegate · park it' },
								{ value: 'drop', label: 'Eliminate · park it' }
							]}
							onchange={(e) =>
								workspace.setQuadrant(task.id, (e.currentTarget.value || null) as Quadrant | null)}
						/>
					</label>
				</section>
			{/if}

			<TaskFields task={draft} onchange={(patch) => workspace.updateTask(task.id, patch)} />

			<section class="flex flex-col gap-2.5">
				<span class={label}>Depends on</span>
				{#each task.deps as id (id)}
					{@const d = depInfo(id)}
					{#if d}
						<div class="flex items-center gap-2.5 border-b border-line py-1.5 text-[13.5px]">
							<span class="font-mono text-[11px] text-faint">{d.code}</span>
							{#if d.sub}<span class="font-mono text-[9.5px] tracking-[0.08em] text-muted uppercase"
									>Sub-task</span
								>{/if}
							<span class="flex-1 truncate {d.done ? 'text-muted line-through' : ''}"
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
						>Blocked · waits on {waits.map((w) => w.ref).join(', ')}</span
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
