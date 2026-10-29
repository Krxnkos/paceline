<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Field from '../ui/Field.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { input } from '../ui/styles.ts';

	let title = $state('');
	let date = $state('');
	let start = $state('10:00');
	let end = $state('10:30');
	let error = $state('');

	$effect(() => {
		if (!ui.meeting.open) return;
		const m = ui.meeting.meeting;
		title = m?.title ?? '';
		date = m?.date ?? ui.meeting.date ?? clock.today;
		start = m?.start ?? '10:00';
		end = m?.end ?? '10:30';
		error = '';
	});

	function save(e: Event) {
		e.preventDefault();
		if (!title.trim()) return (error = 'Give the meeting a name.');
		if (end <= start) return (error = 'End after it starts.');
		const m = ui.meeting.meeting;
		if (m) workspace.updateMeeting(m.id, { title: title.trim(), date, start, end });
		else workspace.addMeeting({ title: title.trim(), date, start, end });
		toast(m ? 'Meeting updated · plan re-run' : 'Meeting added · plan re-run');
		ui.meeting = { open: false };
	}
</script>

<Modal
	bind:open={ui.meeting.open}
	title={ui.meeting.meeting ? 'Edit meeting' : 'New meeting'}
	width={520}
>
	<form id="meeting-form" onsubmit={save} class="flex flex-col gap-4">
		<Field label="Title" {error}>
			<input bind:value={title} class={input} placeholder="Design review" />
		</Field>
		<div class="grid grid-cols-3 gap-3">
			<Field label="Date"
				><input type="date" bind:value={date} class="{input} font-mono text-[13px]" /></Field
			>
			<Field label="Starts"
				><input
					type="time"
					step="300"
					bind:value={start}
					class="{input} font-mono text-[13px]"
				/></Field
			>
			<Field label="Ends"
				><input
					type="time"
					step="300"
					bind:value={end}
					class="{input} font-mono text-[13px]"
				/></Field
			>
		</div>
		<p class="m-0 text-[13px] text-muted">
			Meetings block time. The planner moves everything else around them.
		</p>
	</form>
	{#snippet footer()}
		{#if ui.meeting.meeting}
			{@const id = ui.meeting.meeting.id}
			<Button
				variant="danger"
				icon="trash"
				class="mr-auto"
				onclick={() => {
					ui.meeting = { open: false };
					workspace.deleteMeeting(id);
				}}>Delete</Button
			>
		{/if}
		<Button variant="ghost" onclick={() => (ui.meeting = { open: false })}>Cancel</Button>
		<Button variant="primary" type="submit" form="meeting-form">Save meeting</Button>
	{/snippet}
</Modal>
