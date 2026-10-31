<script lang="ts">
	import { workspace } from '../stores/workspace.svelte.ts';
	import { labelCls } from '../ui/styles.ts';

	let { selected, onchange }: { selected: string[]; onchange: (labels: string[]) => void } =
		$props();

	let name = $state('');

	function toggle(id: string) {
		onchange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
	}

	function create(e: Event) {
		e.preventDefault();
		const n = name.trim().slice(0, 30);
		if (!n) return;
		const existing = workspace.labels.find((l) => l.name.toLowerCase() === n.toLowerCase());
		const l = existing ?? workspace.addLabel(n, 'ice');
		if (!selected.includes(l.id)) onchange([...selected, l.id]);
		name = '';
	}
</script>

{#if workspace.tier.customBoard}
	<div class="flex flex-wrap items-center gap-1.5">
		{#each workspace.labels as l (l.id)}
			<button
				type="button"
				aria-pressed={selected.includes(l.id)}
				onclick={() => toggle(l.id)}
				class="h-7 border px-2 text-xs font-semibold {labelCls[l.color]} {selected.includes(l.id)
					? ''
					: 'opacity-45 hover:opacity-100'}">{l.name}</button
			>
		{/each}
		<input
			bind:value={name}
			onkeydown={(e) => e.key === 'Enter' && create(e)}
			maxlength="30"
			placeholder="New label, Enter"
			aria-label="New label"
			class="h-7 w-32 border border-dashed border-line-3 bg-transparent px-2 text-xs text-ink placeholder:text-faint focus:outline-none"
		/>
	</div>
{:else}
	<span class="text-[13px] text-muted">Custom labels are included in Pro</span>
{/if}
