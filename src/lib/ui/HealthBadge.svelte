<script lang="ts">
	import type { Tone } from '../types.ts';
	import Badge from './Badge.svelte';

	let { label }: { label: string } = $props();
	const tones: Record<string, Tone> = {
		'On track': 'plain',
		'On pace': 'plain',
		Ahead: 'lead',
		Complete: 'lead',
		Achieved: 'lead',
		'At risk': 'warn',
		'Slightly behind': 'warn',
		'Off track': 'late',
		Behind: 'late',
		Missed: 'late',
		'Not started': 'mute'
	};
</script>

<Badge tone={tones[label] ?? 'plain'} {label} />
