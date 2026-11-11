<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Kbd from '../ui/Kbd.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import TaskFields from './TaskFields.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace, openTask } from '../stores/workspace.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { code } from '../domain/forecast.ts';
	import { newTask } from '../domain/seed.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { inputLg, label, toneText } from '../ui/styles.ts';
	import type { Task } from '../types.ts';

	let text = $state('');
	let draft = $state<Partial<Task>>({});
	// Fields the person edited by hand; parsed syntax never overwrites these.
	let touched: Partial<Record<keyof Task, true>> = {};
	let quick = $state(false);
	let error = $state('');

	$effect(() => {
		if (ui.newTask.open) {
			text = ui.newTask.text ?? '';
			draft = {
				category: workspace.defaultCategory(),
				priority: 3,
				estimateMin: 30,
				start: 'auto',
				repeat: '',
				projectId: null,
				due: null,
				...ui.newTask.defaults
			};
			touched = Object.fromEntries(Object.keys(ui.newTask.defaults ?? {}).map((k) => [k, true]));
			quick = false;
			error = '';
		}
	});

	const parsed = $derived(workspace.parse(text));

	// Parsed syntax fills the fields; explicit field edits win.
	$effect(() => {
		const p = parsed;
		const fill = <K extends keyof Task>(k: K, v: Task[K] | undefined) => {
			if (v !== undefined && !touched[k]) draft[k] = v;
		};
		fill('priority', p.imp);
		fill('category', p.cat);
		fill('projectId', p.projectId);
		fill('due', p.due);
		fill('estimateMin', p.est);
		fill('start', p.start);
		fill('startDate', p.startDate);
		fill('repeat', p.repeat);
		if (p.quick) quick = true;
		if (p.personal && workspace.tier.personal) fill('scope', 'personal');
	});

	// Live answer to "where will this land?" as the fields change.
	const preview = $derived.by(() => {
		if (!ui.newTask.open || parsed.kind === 'meeting') return null;
		return workspace.preview(
			newTask(0, clock.today, {
				...$state.snapshot(draft),
				id: '__preview',
				title: parsed.title || 'New task',
				quick,
				inbox: false,
				status: 'next'
			} as Partial<Task>)
		);
	});

	function create(e?: Event) {
		e?.preventDefault();
		if (parsed.kind === 'meeting') {
			workspace.capture(text);
			ui.newTask = { open: false };
			return;
		}
		if (!parsed.title) {
			error = 'Give the task a title.';
			return;
		}
		let projectId = draft.projectId ?? null;
		if (parsed.newProject && !touched.projectId && workspace.canAdd('projects'))
			projectId = workspace.addProject({ name: parsed.newProject, description: '', due: null }).id;
		const t = workspace.addTask({
			...draft,
			title: parsed.title,
			projectId,
			quick,
			inbox: false,
			status: 'next'
		});
		ui.newTask = { open: false };
		toast(`${quick ? 'Quick win added' : 'Added to plan'} · ${code(t.code)}`, {
			action: 'Open',
			onAction: () => openTask(t.id)
		});
	}
</script>

<Modal bind:open={ui.newTask.open} title="New task" width={600}>
	<form id="new-task" onsubmit={create} class="flex flex-col gap-4">
		<label class="flex flex-col gap-2">
			<span class={label}>Title</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={text}
				autofocus
				aria-invalid={!!error}
				placeholder="Call supplier about relay lead times +Test_Fixture @fri 15m #comms"
				class={inputLg}
				onkeydown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') create(e);
				}}
			/>
			{#if error}<span class="text-[13px] text-flare">{error}</span>{/if}
		</label>
		{#if parsed.chips.length}
			<div class="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
				{#each parsed.chips as c (c.l)}
					<span
						class="inline-flex h-[22px] items-center gap-1.5 border border-line-2 bg-raised px-2 text-ink-2"
						><span class="text-muted uppercase">{c.l}</span>{c.v}</span
					>
				{/each}
			</div>
		{/if}
		{#if parsed.kind === 'meeting'}
			<p class="m-0 text-[13.5px] text-ink-3">
				This will add a meeting{parsed.mStart ? ` at ${parsed.mStart}–${parsed.mEnd}` : ''}.
			</p>
		{:else}
			<TaskFields
				bind:task={draft}
				onchange={(patch) => Object.keys(patch).forEach((k) => (touched[k as keyof Task] = true))}
			/>
			<Toggle
				label="Quick win"
				hint="never auto-scheduled"
				checked={quick}
				onchange={(v) => (quick = v)}
			/>
			{#if preview}
				<div
					class="flex flex-col gap-1 border px-3.5 py-3 {preview.tone === 'late'
						? 'border-flare bg-flare/6'
						: preview.tone === 'warn'
							? 'border-amber'
							: 'border-line-2 bg-surface'}"
					aria-live="polite"
				>
					<span class={label}>Where it will show up</span>
					<span class="text-[14px] leading-snug {toneText[preview.tone]}">{preview.text}</span>
				</div>
			{/if}
			<p class="m-0 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
				Smart syntax fills the fields · explicit edits win
			</p>
		{/if}
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (ui.newTask = { open: false })}>Cancel</Button>
		<Button variant="primary" type="submit" form="new-task">
			{parsed.kind === 'meeting' ? 'Add meeting' : 'Create task'}<Kbd>⌘↵</Kbd>
		</Button>
	{/snippet}
</Modal>
