<script lang="ts">
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Select from '../ui/Select.svelte';
	import { focus } from '../stores/focus.svelte.ts';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { code } from '../domain/forecast.ts';

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (ui.focusOpen && !dialog.open) dialog.showModal();
		if (!ui.focusOpen && dialog.open) dialog.close();
	});
	$effect(() => {
		if (!focus.state && ui.focusOpen) ui.focusOpen = false;
	});

	const task = $derived(workspace.task(focus.state?.taskId));
	const options = $derived([
		{ value: '', label: 'No task · just focus' },
		...workspace.tasks
			.filter((t) => t.status !== 'done')
			.map((t) => ({ value: t.id, label: `${code(t.code)} · ${t.title}` }))
	]);
	const paused = $derived(focus.state?.paused ?? false);
	const isBreak = $derived(focus.state?.phase === 'break');
</script>

<dialog
	bind:this={dialog}
	aria-label="Focus timer"
	onclose={() => (ui.focusOpen = false)}
	class="fixed inset-0 h-dvh w-screen bg-canvas"
>
	{#if ui.focusOpen && focus.state}
		<div class="mx-auto flex h-full max-w-[960px] flex-col justify-between gap-8 px-6 py-8">
			<div class="flex items-center justify-between">
				<span class="eyebrow">
					{isBreak ? 'Break' : (task?.category ?? 'Focus')} · {Math.round(focus.state.total / 60)}m
					block
				</span>
				<button
					type="button"
					class="inline-flex h-10 items-center gap-2 px-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:bg-hover hover:text-ink"
					onclick={() => (ui.focusOpen = false)}><Icon name="minimise" size={14} />Minimise</button
				>
			</div>

			<div class="flex flex-col gap-6">
				{#if isBreak}
					<h2 class="m-0 text-[28px] heavy text-ice sm:text-[40px]">
						Step away. Back in a moment.
					</h2>
				{:else if task}
					<h2 class="m-0 text-[24px] leading-tight font-extrabold wide sm:text-[34px]">
						{task.title}
					</h2>
				{:else}
					<div class="flex max-w-xl flex-col gap-2">
						<span class="eyebrow">Focus on</span>
						<Select
							value=""
							{options}
							aria-label="Task to focus on"
							onchange={(e) => {
								if (focus.state) focus.state.taskId = e.currentTarget.value || null;
							}}
						/>
					</div>
				{/if}
				<div
					class="font-mono leading-none font-medium tabular-nums {paused
						? 'text-muted'
						: isBreak
							? 'text-ice'
							: 'text-accent-text'}"
					style="font-size: clamp(72px, 16vw, 168px)"
					role="timer"
					aria-live="off"
				>
					{focus.clock}
				</div>
				<div class="h-1 w-full bg-line">
					<div
						class="h-1 {isBreak ? 'bg-ice' : 'bg-accent'}"
						style="width: {focus.progress * 100}%"
					></div>
				</div>
			</div>

			<div class="flex flex-wrap gap-2.5">
				<Button
					variant="primary"
					size="lg"
					icon={paused ? 'play' : 'pause'}
					onclick={() => focus.toggle()}>{paused ? 'Resume' : 'Pause'}</Button
				>
				<Button size="lg" onclick={() => focus.addFive()}>+5 min</Button>
				{#if task && !isBreak}
					<Button size="lg" icon="check" onclick={() => focus.completeTask()}>Complete task</Button>
				{/if}
				<Button
					size="lg"
					variant="ghost"
					onclick={() => (isBreak ? focus.reset() : focus.endAndLog())}
					>{isBreak ? 'Skip break' : 'End & log'}</Button
				>
			</div>
		</div>
	{/if}
</dialog>
