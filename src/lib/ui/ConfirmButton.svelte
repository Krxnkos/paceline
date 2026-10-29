<script lang="ts">
	import Button from './Button.svelte';

	// Two-step inline confirm for actions with no undo. Resets after 6s.
	let {
		label,
		confirmLabel,
		onconfirm,
		size = 'md'
	}: { label: string; confirmLabel: string; onconfirm: () => void; size?: 'md' | 'sm' } = $props();

	let armed = $state(false);
	let t: ReturnType<typeof setTimeout> | undefined;

	function arm() {
		armed = true;
		clearTimeout(t);
		t = setTimeout(() => (armed = false), 6000);
	}
</script>

{#if armed}
	<span class="inline-flex gap-2">
		<Button
			variant="danger"
			{size}
			class="bg-flare/12"
			onclick={() => {
				armed = false;
				onconfirm();
			}}>{confirmLabel}</Button
		>
		<Button variant="ghost" {size} onclick={() => (armed = false)}>Cancel</Button>
	</span>
{:else}
	<Button variant="secondary" {size} onclick={arm}>{label}</Button>
{/if}
