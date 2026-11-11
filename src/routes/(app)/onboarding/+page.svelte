<script lang="ts">
	import { goto } from '$app/navigation';
	import Mark from '#lib/ui/Mark.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import type { DailyMethod } from '#lib/types.ts';

	const STYLES: { id: DailyMethod; name: string; blurb: string }[] = [
		{ id: 'must3', name: 'Must-dos', blurb: 'Three things that make the day a win' },
		{ id: 'frog', name: 'Eat the frog', blurb: 'Hardest task first thing' },
		{ id: 'ivy', name: 'Ivy Lee', blurb: 'Six tasks, strictly in order' },
		{ id: 'one35', name: '1-3-5', blurb: 'One big, three medium, five small' }
	];
	let style = $state<DailyMethod>('must3');

	function start(kind: 'example' | 'blank') {
		workspace.start(kind);
		if (style !== 'must3') workspace.updateSettings({ dailyMethod: style });
		toast(
			kind === 'example'
				? 'Example plan loaded · reset it any time in Settings'
				: 'Blank plan ready · capture your first task'
		);
		goto('/today');
	}

	const first = $derived((auth.user?.name ?? '').split(' ')[0]);
</script>

<svelte:head><title>Paceline · Welcome</title></svelte:head>

<div class="mx-auto flex max-w-[960px] flex-col gap-10 px-4 py-10 nav:px-8 nav:py-14">
	<div class="flex flex-col gap-5">
		<div
			class="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-muted uppercase"
		>
			<span class="text-accent-text">00</span><span class="inline-block h-px w-9 bg-line-3"
			></span>Set your pace
		</div>
		<h1 class="m-0 text-[38px] heavy sm:text-[52px]">
			Welcome{first ? `, ${first}` : ''}.<br /><span class="text-accent-text"
				>Pick a starting line.</span
			>
		</h1>
		<p class="m-0 max-w-[600px] text-[17px] leading-relaxed text-ink-3">
			Paceline lines your work up in priority order, timeboxes it into your real working hours and
			tells you honestly when it will finish. Start from a worked example or a clean sheet.
		</p>
	</div>

	<div class="flex flex-col gap-3">
		<span class="eyebrow">How do you like to plan your day?</span>
		<div class="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Planning style">
			{#each STYLES as m (m.id)}
				<button
					type="button"
					role="radio"
					aria-checked={style === m.id}
					onclick={() => (style = m.id)}
					class="flex flex-col gap-1 border p-3.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] {style ===
					m.id
						? 'border-ink bg-surface'
						: 'border-line-2 hover:border-ink-3'}"
				>
					<span class="text-[15px] font-bold">{m.name}</span>
					<span class="text-[12.5px] leading-snug text-ink-3">{m.blurb}</span>
				</button>
			{/each}
		</div>
		<span class="text-[13px] text-muted"
			>You can switch any time, and try the Matrix, focus rhythms and weekly review from the menu.</span
		>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<button
			type="button"
			onclick={() => start('example')}
			class="group flex flex-col gap-5 border border-line bg-surface p-6 text-left transition-colors hover:border-accent"
		>
			<span class="flex items-center justify-between">
				<span class="eyebrow">Recommended</span>
				<Mark width={44} />
			</span>
			<span class="text-[24px] font-extrabold wide">Example plan</span>
			<span class="text-[14.5px] leading-relaxed text-ink-3">
				Four projects, twenty-odd tasks with dependencies, daily stand-ups and three goals, laid out
				around today. See every view working, then clear it in Settings.
			</span>
			<span class="mt-auto inline-flex items-center gap-2 font-bold text-accent-text"
				>Load the example <Icon name="arrowRight" size={15} /></span
			>
		</button>
		<button
			type="button"
			onclick={() => start('blank')}
			class="group flex flex-col gap-5 border border-line p-6 text-left transition-colors hover:border-ink-3"
		>
			<span class="flex items-center justify-between">
				<span class="eyebrow">Clean sheet</span>
				<Mark width={44} lead="var(--line-3)" ink="var(--line-2)" />
			</span>
			<span class="text-[24px] font-extrabold wide">Blank plan</span>
			<span class="text-[14.5px] leading-relaxed text-ink-3">
				A plain Monday to Friday, 09:00–17:00 with a half-hour lunch. Change your hours, days off,
				categories and planning style any time in Settings.
			</span>
			<span class="mt-auto inline-flex items-center gap-2 font-bold text-ink"
				>Start blank <Icon name="arrowRight" size={15} /></span
			>
		</button>
	</div>
</div>
