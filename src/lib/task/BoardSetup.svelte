<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { input, label, labelCls } from '../ui/styles.ts';
	import { LABEL_COLORS, type LabelColor } from '../types.ts';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let column = $state('');
	let name = $state('');
	let color = $state<LabelColor>('ice');
	const fixed = ['backlog', 'doing', 'done'];
</script>

<Modal bind:open title="Customise board" width={560}>
	<section class="flex flex-col gap-2">
		<span class={label}>Columns</span>
		{#each workspace.columns as c, i (c.id)}
			<div class="flex items-center gap-1.5">
				<input
					value={c.label}
					maxlength="30"
					aria-label="Column name"
					class={input}
					onchange={(e) =>
						e.currentTarget.value.trim() &&
						workspace.renameColumn(c.id, e.currentTarget.value.trim())}
				/>
				<Button
					icon="chevronLeft"
					iconOnly
					aria-label="Move {c.label} left"
					disabled={i === 0}
					onclick={() => workspace.moveColumn(c.id, -1)}
				></Button>
				<Button
					icon="chevronRight"
					iconOnly
					aria-label="Move {c.label} right"
					disabled={i === workspace.columns.length - 1}
					onclick={() => workspace.moveColumn(c.id, 1)}
				></Button>
				<Button
					icon="trash"
					iconOnly
					aria-label="Delete {c.label}"
					disabled={fixed.includes(c.id)}
					onclick={() => workspace.deleteColumn(c.id)}
				></Button>
			</div>
		{/each}
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				if (column.trim()) workspace.addColumn(column.trim());
				column = '';
			}}
		>
			<input bind:value={column} maxlength="30" placeholder="New column" class={input} />
			<Button type="submit" icon="plus">Add</Button>
		</form>
		<p class="m-0 text-xs text-muted">
			Backlog, In progress and Done can be renamed but not deleted. The planner schedules tasks in
			any column except Done.
		</p>
	</section>

	<section class="flex flex-col gap-2 border-t border-line pt-4">
		<span class={label}>Labels</span>
		<div class="flex flex-wrap gap-1.5">
			{#each workspace.labels as l (l.id)}
				<span
					class="inline-flex h-7 items-center gap-1.5 border pr-1 pl-2 text-xs font-semibold {labelCls[
						l.color
					]}"
				>
					{l.name}
					<button
						type="button"
						aria-label="Delete {l.name}"
						onclick={() => workspace.deleteLabel(l.id)}><Icon name="x" size={12} /></button
					>
				</span>
			{:else}
				<span class="text-[13px] text-muted">No labels yet.</span>
			{/each}
		</div>
		<form
			class="flex flex-wrap gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				if (name.trim()) workspace.addLabel(name.trim(), color);
				name = '';
			}}
		>
			<input
				bind:value={name}
				maxlength="30"
				placeholder="New label"
				class="{input} min-w-40 flex-1"
			/>
			<div role="group" aria-label="Label colour" class="flex items-center gap-1">
				{#each LABEL_COLORS as c (c)}
					<button
						type="button"
						aria-label={c}
						aria-pressed={color === c}
						onclick={() => (color = c)}
						class="size-7 border-2 {labelCls[c]} {color === c ? '' : 'opacity-40'}"
						>{color === c ? '✓' : ''}</button
					>
				{/each}
			</div>
			<Button type="submit" icon="plus">Add</Button>
		</form>
	</section>
</Modal>
