<script lang="ts">
	import { goto } from '$app/navigation';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Field from '../ui/Field.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { input } from '../ui/styles.ts';

	let name = $state('');
	let description = $state('');
	let due = $state('');
	let error = $state('');

	$effect(() => {
		if (!ui.project.open) return;
		const p = ui.project.project;
		name = p?.name ?? '';
		description = p?.description ?? '';
		due = p?.due ?? '';
		error = '';
	});

	function save(e: Event) {
		e.preventDefault();
		if (!name.trim()) return (error = 'Give the project a name.');
		const p = ui.project.project;
		const patch = { name: name.trim(), description: description.trim(), due: due || null };
		if (p) {
			workspace.updateProject(p.id, patch);
			toast('Project saved');
		} else {
			const np = workspace.addProject(patch);
			toast(`Project P-${String(np.code).padStart(2, '0')} created`);
			goto(`/projects/${np.id}`);
		}
		ui.project = { open: false };
	}
</script>

<Modal
	bind:open={ui.project.open}
	title={ui.project.project ? 'Edit project' : 'New project'}
	width={520}
>
	<form id="project-form" onsubmit={save} class="flex flex-col gap-4">
		<Field label="Name" {error}
			><input
				bind:value={name}
				class={input}
				placeholder="Test Fixture Rev B"
				aria-invalid={!!error}
			/></Field
		>
		<Field label="Description"
			><input
				bind:value={description}
				class={input}
				placeholder="One line on what done looks like"
			/></Field
		>
		<Field label="Target date" hint="Health turns amber when the forecast passes it.">
			<input type="date" bind:value={due} class="{input} font-mono text-[13px]" />
		</Field>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (ui.project = { open: false })}>Cancel</Button>
		<Button variant="primary" type="submit" form="project-form"
			>{ui.project.project ? 'Save project' : 'Create project'}</Button
		>
	{/snippet}
</Modal>
