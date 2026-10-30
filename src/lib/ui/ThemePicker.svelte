<script lang="ts">
	import { THEMES, theme } from '../stores/theme.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import type { ThemeChoice } from '../types.ts';
	import Segmented from './Segmented.svelte';
	import { toast } from '../stores/toast.svelte.ts';

	// Each preview is drawn from fixed hex values so every card shows its own theme.
	const locked = (t: (typeof THEMES)[number]) =>
		workspace.tier.themes !== 'all' && t.family !== 'Volt';

	function pick(choice: ThemeChoice) {
		const t = THEMES.find((x) => x.id === choice);
		if (t && locked(t)) return toast(`${t.label} is a Pro theme.`, { tone: 'err' });
		theme.set(choice);
		if (workspace.data) workspace.updateSettings({ theme: choice });
	}

	function onKey(e: KeyboardEvent, i: number) {
		const n = THEMES.length;
		const step =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!step) return;
		e.preventDefault();
		const next = THEMES[(i + step + n) % n];
		pick(next.id);
		(document.getElementById(`theme-${next.id}`) as HTMLElement | null)?.focus();
	}

	const mode = $derived(
		theme.choice === 'system' ? 'system' : THEMES.find((t) => t.id === theme.choice)!.mode
	);
</script>

<div class="flex flex-col gap-4">
	<div role="radiogroup" aria-label="Theme" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		{#each THEMES as t, i (t.id)}
			{@const selected = theme.choice === t.id}
			<button
				id="theme-{t.id}"
				type="button"
				role="radio"
				aria-checked={selected}
				tabindex={selected || (theme.choice === 'system' && i === 0) ? 0 : -1}
				onclick={() => pick(t.id)}
				onkeydown={(e) => onKey(e, i)}
				class="flex flex-col gap-2 border border-line-2 bg-surface p-2 text-left hover:border-line-3 {selected
					? 'outline-2 outline-offset-2 outline-accent'
					: ''}"
			>
				<span
					class="flex h-[74px] flex-col gap-1.5 border p-2"
					style="background:{t.canvas};border-color:{t.line}"
				>
					<span class="flex items-center gap-1.5">
						<span class="h-1.5 w-8" style="background:{t.ink}"></span>
						<span class="h-1.5 w-4" style="background:{t.muted}"></span>
					</span>
					<span class="h-5 w-full" style="background:{t.accent}"></span>
					<span class="flex gap-1">
						<span class="h-3 flex-1" style="background:{t.surface};border:1px solid {t.line}"
						></span>
						<span class="h-3 flex-1" style="background:{t.surface};border:1px solid {t.line}"
						></span>
					</span>
				</span>
				<span class="flex flex-col px-0.5">
					<span class="text-[13.5px] font-bold text-ink">{t.label}</span>
					<span class="font-mono text-[10px] tracking-[0.1em] text-muted uppercase"
						>{locked(t) ? 'Pro' : `${t.mode} · ${t.family}`}</span
					>
				</span>
			</button>
		{/each}
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<Segmented
			label="Mode"
			value={mode}
			options={[
				{ id: 'dark', label: 'Dark' },
				{ id: 'light', label: 'Light' },
				{ id: 'system', label: 'Match system' }
			]}
			onchange={(m) => {
				if (m === 'system') return pick('system');
				const cur = theme.resolved;
				const fam = THEMES.find((t) => t.id === cur)!.family;
				pick(THEMES.find((t) => t.family === fam && t.mode === m)!.id);
			}}
		/>
		<span class="text-[13px] text-muted"
			>Match system uses Carbon in the dark and Chalk in the light.</span
		>
	</div>
</div>
