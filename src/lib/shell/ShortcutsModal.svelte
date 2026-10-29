<script lang="ts">
	import Modal from '../ui/Modal.svelte';
	import Kbd from '../ui/Kbd.svelte';
	import { ui } from '../stores/ui.svelte.ts';
	import { ALL_NAV } from './nav.ts';
	import { SYNTAX_REFERENCE } from '../domain/parse.ts';

	const keys: [string, string][] = [
		['⌘K', 'Command palette'],
		['N', 'New task'],
		['/', 'Focus capture or search'],
		['F', 'Start or open focus'],
		['⌘Z', 'Undo'],
		['[', 'Hide or show the sidebar'],
		['?', 'This list'],
		['Esc', 'Close any layer']
	];
</script>

<Modal bind:open={ui.shortcuts} title="Keyboard shortcuts" width={640}>
	<div class="grid gap-6 sm:grid-cols-2">
		<div class="flex flex-col">
			<span class="pb-2 eyebrow">Everywhere</span>
			{#each keys as [k, v] (k)}
				<div class="flex items-center justify-between border-b border-line py-2 text-[13.5px]">
					<span>{v}</span><Kbd>{k}</Kbd>
				</div>
			{/each}
			<span class="pt-5 pb-2 eyebrow">Go to</span>
			{#each ALL_NAV as n (n.href)}
				<div class="flex items-center justify-between border-b border-line py-2 text-[13.5px]">
					<span>{n.label}</span><Kbd>G {n.key.toUpperCase()}</Kbd>
				</div>
			{/each}
		</div>
		<div class="flex flex-col">
			<span class="pb-2 eyebrow">Capture syntax</span>
			{#each SYNTAX_REFERENCE as s (s.token)}
				<div class="flex flex-col gap-0.5 border-b border-line py-2">
					<span class="font-mono text-[12px] text-ink">{s.token}</span>
					<span class="text-[12.5px] text-muted">{s.meaning}</span>
				</div>
			{/each}
		</div>
	</div>
</Modal>
