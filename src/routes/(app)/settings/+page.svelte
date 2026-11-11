<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Panel from '#lib/ui/Panel.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import ThemePicker from '#lib/ui/ThemePicker.svelte';
	import PlanBadge from '#lib/ui/PlanBadge.svelte';
	import { TIERS } from '#lib/tiers.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { workspace } from '#lib/stores/workspace.svelte.ts';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { toast } from '#lib/stores/toast.svelte.ts';
	import { clock } from '#lib/stores/clock.svelte.ts';
	import { DOW_LONG, fmtShort, dayWorkMinutes, fmtHours } from '#lib/domain/dates.ts';
	import { input } from '#lib/ui/styles.ts';
	import type {
		Category,
		DailyMethod,
		DayPattern,
		FocusPreset,
		Reserved,
		Weekday
	} from '#lib/types.ts';
	import { flip } from 'svelte/animate';
	import { CAT_BG, CAT_COLORS } from '#lib/ui/categories.ts';
	import { FOCUS_PRESETS, presetOf } from '#lib/stores/focus.svelte.ts';
	import { uid } from '#lib/domain/seed.ts';

	const s = $derived(workspace.settings);
	const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
	let name = $state(auth.user?.name ?? '');
	let leaveDate = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	function setPattern(d: Weekday, p: DayPattern) {
		workspace.updateSettings({ pattern: { ...s.pattern, [d]: p } });
	}

	function setKind(d: Weekday, kind: DayPattern['kind']) {
		if (kind === 'work')
			setPattern(d, { kind: 'work', start: '09:00', end: '17:00', lunch: ['12:00', '12:30'] });
		else if (kind === 'uni') setPattern(d, { kind: 'uni', label: 'Away' });
		else if (kind === 'personal') setPattern(d, { kind: 'personal', start: '09:00', end: '18:00' });
		else setPattern(d, { kind: 'off' });
	}

	const reserved = $derived(s.reserved ?? []);
	let newCat = $state('');
	const METHODS: { id: DailyMethod; name: string; blurb: string }[] = [
		{
			id: 'must3',
			name: 'Must-dos 1–3',
			blurb: 'Three things that make the day a win. Two more unlock once they’re done.'
		},
		{
			id: 'ivy',
			name: 'Ivy Lee',
			blurb:
				'Six tasks in strict order. Finish one before starting the next; the order is planned first.'
		},
		{
			id: 'one35',
			name: '1-3-5',
			blurb: 'One big thing, three medium and five small, sized by estimate. A realistic day.'
		},
		{
			id: 'frog',
			name: 'Eat the frog',
			blurb:
				'Your hardest, most important task goes first thing in the morning, before anything else.'
		}
	];
	function setReserved(id: string, patch: Partial<Reserved>) {
		workspace.updateSettings({
			reserved: reserved.map((r) => (r.id === id ? { ...r, ...patch } : r))
		});
	}

	function num(v: string, min: number, max: number) {
		return Math.min(max, Math.max(min, Number(v) || 0));
	}

	function exportData() {
		const blob = new Blob([workspace.exportJSON()], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `paceline-${clock.today}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function importData(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		try {
			workspace.importJSON(await f.text());
			toast('Imported · plan re-run', { action: 'Undo', onAction: () => workspace.undo() });
		} catch {
			toast('That file isn’t a Paceline export.', { tone: 'err' });
		}
		(e.currentTarget as HTMLInputElement).value = '';
	}

	const weekly = $derived(order.reduce<number>((n, d) => n + dayWorkMinutes(s.pattern[d]), 0));
	const notifState = $state({
		v: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
	});
</script>

<svelte:head><title>Paceline · Settings</title></svelte:head>

<div class="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-7 pb-16 nav:px-8">
	<PageHead index="11" eyebrow="Settings · saved as you go" title="Your pace, your rules." />

	<Panel title="Appearance">
		<div class="p-[18px]"><ThemePicker /></div>
	</Panel>

	<Panel title="Working pattern" meta="{fmtHours(weekly)} h a week before buffer">
		<div class="flex flex-col">
			{#each order as d (d)}
				{@const p = s.pattern[d]}
				<div
					class="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3 last:border-0"
				>
					<span class="w-28 text-sm font-semibold">{DOW_LONG[d]}</span>
					<Select
						value={p.kind}
						aria-label="{DOW_LONG[d]} type"
						class="w-40"
						options={[
							{ value: 'work', label: 'Work day' },
							{ value: 'uni', label: 'Away · no tasks' },
							{
								value: 'personal',
								label: workspace.tier.personal ? 'Personal' : 'Personal · Pro',
								disabled: !workspace.tier.personal
							},
							{ value: 'off', label: 'Day off' }
						]}
						onchange={(e) => setKind(d, e.currentTarget.value as DayPattern['kind'])}
					/>
					{#if p.kind === 'work'}
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>FROM
							<input
								type="time"
								step="300"
								value={p.start}
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) => setPattern(d, { ...p, start: e.currentTarget.value })}
							/></label
						>
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>TO
							<input
								type="time"
								step="300"
								value={p.end}
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) => setPattern(d, { ...p, end: e.currentTarget.value })}
							/></label
						>
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>LUNCH
							<input
								type="time"
								step="300"
								value={p.lunch?.[0] ?? ''}
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) =>
									setPattern(d, {
										...p,
										lunch: e.currentTarget.value
											? [e.currentTarget.value, p.lunch?.[1] ?? e.currentTarget.value]
											: undefined
									})}
							/>–<input
								type="time"
								step="300"
								value={p.lunch?.[1] ?? ''}
								aria-label="Lunch ends"
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) =>
									p.lunch && setPattern(d, { ...p, lunch: [p.lunch[0], e.currentTarget.value] })}
							/></label
						>
					{:else if p.kind === 'personal'}
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>FROM
							<input
								type="time"
								step="300"
								value={p.start}
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) => setPattern(d, { ...p, start: e.currentTarget.value })}
							/></label
						>
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>TO
							<input
								type="time"
								step="300"
								value={p.end}
								class="{input} w-28 font-mono text-[13px]"
								onchange={(e) => setPattern(d, { ...p, end: e.currentTarget.value })}
							/></label
						>
						<span class="text-[13px] text-muted">Personal tasks only</span>
					{:else if p.kind === 'uni'}
						<label class="flex items-center gap-2 font-mono text-[11px] text-muted"
							>CALLED
							<input
								value={p.label ?? ''}
								maxlength="24"
								placeholder="Away"
								class="{input} w-40 text-[13px]"
								onchange={(e) =>
									setPattern(d, { kind: 'uni', label: e.currentTarget.value.trim() })}
							/></label
						>
						<span class="text-[13px] text-muted"
							>e.g. University, Training, Client site · nothing is planned</span
						>
					{/if}
				</div>
			{/each}
		</div>
	</Panel>

	<Panel title="Planning method">
		<div class="flex flex-col gap-5 p-[18px]">
			<div class="flex flex-col gap-2">
				<span class="eyebrow">Today’s short list</span>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each METHODS as m (m.id)}
						{@const on = (s.dailyMethod ?? 'must3') === m.id}
						<button
							type="button"
							aria-pressed={on}
							onclick={() => workspace.updateSettings({ dailyMethod: m.id })}
							class="flex flex-col gap-1 border p-3.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.99] {on
								? 'border-ink bg-surface'
								: 'border-line-2 hover:border-ink-3'}"
						>
							<span class="flex items-center justify-between gap-2">
								<span class="text-[15px] font-bold">{m.name}</span>
								{#if on}<span
										class="font-mono text-[10px] tracking-[0.1em] text-accent-text uppercase"
										>In use</span
									>{/if}
							</span>
							<span class="text-[13px] leading-snug text-ink-3">{m.blurb}</span>
						</button>
					{/each}
				</div>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Focus rhythm" hint={FOCUS_PRESETS[presetOf(s)].hint}>
					<Select
						value={presetOf(s)}
						options={Object.entries(FOCUS_PRESETS).map(([value, p]) => ({ value, label: p.label }))}
						onchange={(e) => {
							const v = e.currentTarget.value as FocusPreset;
							workspace.updateSettings({
								focusPreset: v,
								focusMode: v === 'fit' ? 'fit' : 'fixed'
							});
						}}
					/>
				</Field>
				<Field label="Matrix: urgent means due within" hint="Used by the Eisenhower Matrix.">
					<Select
						value={s.urgentDays ?? 2}
						options={[0, 1, 2, 3, 5, 7].map((n) => ({
							value: n,
							label: n === 0 ? 'Today' : `${n} day${n === 1 ? '' : 's'}`
						}))}
						onchange={(e) =>
							workspace.updateSettings({ urgentDays: Number(e.currentTarget.value) })}
					/>
				</Field>
			</div>
			<p class="m-0 text-[13px] text-muted">
				Also built in: time blocking (the planner), quick wins and batching (reserved time), day
				theming (reserved time ▸ Whole day), the <a href="/matrix" class="underline"
					>Eisenhower Matrix</a
				>, GTD’s Someday/Maybe and Waiting for (in each task), and a guided
				<a href="/review" class="underline">weekly review</a>.
			</p>
		</div>
	</Panel>

	<Panel title="Categories" meta="{workspace.categories.length} in use">
		<div class="flex flex-col">
			<p class="m-0 border-b border-line px-[18px] py-3 text-[13.5px] text-ink-3">
				The kinds of work you do. Each gets a colour, and you can tell the planner to put it in the
				morning or afternoon. Type <span class="font-mono text-ink-2">#</span> and the start of a name
				when capturing.
			</p>
			{#each workspace.categories as c (c.name)}
				{@const used = workspace.tasks.filter((t) => t.category === c.name).length}
				<div
					class="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3"
					animate:flip={{ duration: 220 }}
				>
					<input
						value={c.name}
						maxlength="32"
						aria-label="Category name"
						class="{input} w-44"
						onchange={(e) => workspace.updateCategory(c.name, { name: e.currentTarget.value })}
					/>
					<div class="flex gap-1" role="group" aria-label="Colour">
						{#each CAT_COLORS as col (col)}
							<button
								type="button"
								aria-label={col}
								aria-pressed={c.color === col}
								class="grid size-8 place-items-center border transition-transform hover:scale-110 {c.color ===
								col
									? 'border-ink'
									: 'border-transparent'}"
								onclick={() => workspace.updateCategory(c.name, { color: col })}
								><span class="size-4 {CAT_BG[col]}"></span></button
							>
						{/each}
					</div>
					<Select
						value={c.when}
						class="w-40"
						aria-label="Best time of day"
						options={[
							{ value: 'any', label: 'Any time' },
							{ value: 'morning', label: 'Mornings first' },
							{ value: 'afternoon', label: 'Afternoons first' }
						]}
						onchange={(e) =>
							workspace.updateCategory(c.name, {
								when: e.currentTarget.value as 'any' | 'morning' | 'afternoon'
							})}
					/>
					<span class="font-mono text-[11px] text-muted">{used} task{used === 1 ? '' : 's'}</span>
					<button
						type="button"
						class="ml-auto grid size-10 place-items-center text-muted hover:text-flare disabled:opacity-30"
						aria-label="Remove {c.name}"
						disabled={workspace.categories.length <= 1}
						onclick={() =>
							workspace.deleteCategory(
								c.name,
								workspace.catNames.find((n) => n !== c.name) ?? c.name
							)}><Icon name="trash" size={16} /></button
					>
				</div>
			{/each}
			<form
				class="flex flex-wrap gap-2 px-[18px] py-3.5"
				onsubmit={(e) => {
					e.preventDefault();
					workspace.addCategory(
						newCat,
						CAT_COLORS[workspace.categories.length % CAT_COLORS.length]
					);
					newCat = '';
				}}
			>
				<input bind:value={newCat} placeholder="New category, e.g. Writing" class="{input} w-60" />
				<Button size="md" icon="plus" type="submit">Add category</Button>
			</form>
		</div>
	</Panel>

	<Panel title="Planner">
		<div class="grid gap-4 p-[18px] sm:grid-cols-2">
			<Field label="Buffer kept free" hint="Share of each work day the planner leaves empty.">
				<input
					type="number"
					min="0"
					max="60"
					step="5"
					value={s.bufferPct}
					class="{input} font-mono"
					onchange={(e) =>
						workspace.updateSettings({ bufferPct: num(e.currentTarget.value, 0, 60) })}
				/>
			</Field>
			<Field label="Work-in-progress limit" hint="The Board turns red past this many in progress.">
				<input
					type="number"
					min="1"
					max="10"
					value={s.wipLimit}
					class="{input} font-mono"
					onchange={(e) =>
						workspace.updateSettings({ wipLimit: num(e.currentTarget.value, 1, 10) })}
				/>
			</Field>
			<Field label="Custom focus · minutes" hint="Used when the rhythm is Custom.">
				<input
					type="number"
					min="5"
					max="120"
					step="5"
					value={s.focusMin}
					class="{input} font-mono"
					onchange={(e) =>
						workspace.updateSettings({ focusMin: num(e.currentTarget.value, 5, 120) })}
				/>
			</Field>

			<Field label="Custom break · minutes" hint="Used by Custom and Fit the block.">
				<input
					type="number"
					min="1"
					max="60"
					value={s.breakMin}
					class="{input} font-mono"
					onchange={(e) =>
						workspace.updateSettings({ breakMin: num(e.currentTarget.value, 1, 60) })}
				/>
			</Field>
			<div class="flex flex-col gap-1 sm:col-span-2">
				<Toggle
					label="Fill free time with quick wins"
					hint="gaps and reserved time nobody needed"
					checked={s.fillQuickWins !== false}
					onchange={(v) => workspace.updateSettings({ fillQuickWins: v })}
				/>
				<span class="text-[13px] text-muted"
					>Quick wins go in after everything else is planned, and may use the buffer. Confirm a day
					on Today or Week to stop its blocks moving.</span
				>
			</div>
			<div class="flex flex-col gap-2 sm:col-span-2">
				<span class="eyebrow">Notifications</span>
				<div class="flex flex-wrap items-center gap-3">
					<Button
						size="md"
						icon="bell"
						disabled={notifState.v !== 'default'}
						onclick={async () => (notifState.v = await Notification.requestPermission())}
						>{notifState.v === 'granted'
							? 'Notifications on'
							: notifState.v === 'denied'
								? 'Blocked in browser settings'
								: notifState.v === 'unsupported'
									? 'Not supported here'
									: 'Notify me when a block ends'}</Button
					>
				</div>
			</div>
		</div>
	</Panel>

	<Panel title="Reserved time" meta="{reserved.length} slot{reserved.length === 1 ? '' : 's'}">
		<div class="flex flex-col">
			<p class="m-0 border-b border-line px-[18px] py-3 text-[13.5px] text-ink-3">
				Set time aside on work days for one kind of task, like 20 minutes of Admin at the start of
				each day. Only tasks in that category are planned into it, and it shows on Today and Week.
			</p>
			{#each reserved as r (r.id)}
				<div
					class="flex flex-wrap items-end gap-3 border-b border-line px-[18px] py-3.5 last:border-0"
				>
					<label class="flex flex-col gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-muted"
						>NAME
						<input
							value={r.label}
							maxlength="40"
							class="{input} w-40"
							onchange={(e) =>
								setReserved(r.id, { label: e.currentTarget.value.trim() || r.category })}
						/></label
					>
					<label class="flex flex-col gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-muted"
						>FOR
						<Select
							value={r.category}
							class="w-36"
							options={workspace.catNames.map((c) => ({ value: c, label: c }))}
							onchange={(e) => setReserved(r.id, { category: e.currentTarget.value as Category })}
						/></label
					>
					<label class="flex flex-col gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-muted"
						>STARTS
						<span class="flex gap-2">
							<Select
								value={r.start === 'start' ? 'start' : 'time'}
								class="w-40"
								options={[
									{ value: 'start', label: 'Start of day' },
									{ value: 'time', label: 'At a time' }
								]}
								onchange={(e) =>
									setReserved(r.id, {
										start: e.currentTarget.value === 'start' ? 'start' : '09:00'
									})}
							/>
							{#if r.start !== 'start'}
								<input
									type="time"
									step="300"
									value={r.start}
									aria-label="Start time"
									class="{input} w-28 font-mono text-[13px]"
									onchange={(e) =>
										e.currentTarget.value && setReserved(r.id, { start: e.currentTarget.value })}
								/>
							{/if}
						</span></label
					>
					<div class="flex flex-col gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-muted">
						<span>HOW LONG</span>
						<span class="flex items-center gap-2">
							{#if r.minutes < 24 * 60}
								<input
									type="number"
									min="5"
									max="480"
									step="5"
									value={r.minutes}
									aria-label="Minutes"
									class="{input} w-24 font-mono"
									onchange={(e) =>
										setReserved(r.id, { minutes: num(e.currentTarget.value, 5, 480) })}
								/>
							{/if}
							<button
								type="button"
								aria-pressed={r.minutes >= 24 * 60}
								title="Day theming: the whole working day goes to this category"
								class="h-10 border px-3 font-mono text-[11px] uppercase transition-colors {r.minutes >=
								24 * 60
									? 'border-ink bg-ink text-canvas'
									: 'border-line-2 text-muted hover:border-ink-3'}"
								onclick={() =>
									setReserved(r.id, {
										minutes: r.minutes >= 24 * 60 ? 60 : 24 * 60,
										start: 'start'
									})}>Whole day</button
							>
						</span>
					</div>
					<div class="flex flex-col gap-1.5">
						<span class="font-mono text-[10.5px] tracking-[0.1em] text-muted">DAYS</span>
						<div class="flex gap-1" role="group" aria-label="Days">
							{#each order as d (d)}
								{@const on = r.days.includes(d)}
								<button
									type="button"
									aria-pressed={on}
									aria-label={DOW_LONG[d]}
									class="size-10 border font-mono text-[11px] {on
										? 'border-ink bg-ink text-canvas'
										: 'border-line-2 text-muted hover:border-ink-3'}"
									onclick={() =>
										setReserved(r.id, {
											days: on ? r.days.filter((x) => x !== d) : [...r.days, d].sort()
										})}>{DOW_LONG[d].slice(0, 2)}</button
								>
							{/each}
						</div>
					</div>
					<button
						type="button"
						class="ml-auto flex size-10 items-center justify-center text-muted hover:text-flare"
						aria-label="Remove {r.label}"
						onclick={() =>
							workspace.updateSettings({ reserved: reserved.filter((x) => x.id !== r.id) })}
						><Icon name="trash" size={16} /></button
					>
				</div>
			{/each}
			<div class="px-[18px] py-3.5">
				<Button
					size="md"
					icon="plus"
					onclick={() =>
						workspace.updateSettings({
							reserved: [
								...reserved,
								{
									id: uid(),
									label: workspace.defaultCategory(true),
									category: workspace.defaultCategory(true),
									start: 'start',
									minutes: 20,
									days: [1, 2, 3, 4, 5]
								}
							]
						})}>Add reserved time</Button
				>
			</div>
		</div>
	</Panel>

	<Panel title="Leave" meta="{s.leave.length} day{s.leave.length === 1 ? '' : 's'}">
		<div class="flex flex-col gap-3 p-[18px]">
			<form
				class="flex flex-wrap gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					if (leaveDate && !s.leave.includes(leaveDate))
						workspace.updateSettings({ leave: [...s.leave, leaveDate].sort() });
					leaveDate = '';
				}}
			>
				<input
					type="date"
					bind:value={leaveDate}
					aria-label="Leave day"
					class="{input} w-48 font-mono text-[13px]"
				/>
				<Button type="submit" icon="plus">Add day</Button>
			</form>
			<div class="flex flex-wrap gap-2">
				{#each s.leave as d (d)}
					<span
						class="inline-flex h-8 items-center gap-2 border border-line-2 pr-1 pl-2.5 font-mono text-xs"
					>
						{fmtShort(d)}
						<button
							type="button"
							aria-label="Remove {fmtShort(d)}"
							class="inline-flex size-6 items-center justify-center text-muted hover:text-flare"
							onclick={() => workspace.updateSettings({ leave: s.leave.filter((x) => x !== d) })}
							><Icon name="x" size={12} /></button
						>
					</span>
				{:else}
					<span class="text-sm text-muted">No leave booked. Leave days are never planned.</span>
				{/each}
			</div>
		</div>
	</Panel>

	<Panel title="Your data">
		<div class="flex flex-col gap-4 p-[18px]">
			<p class="m-0 text-sm text-ink-3">
				Your plan is saved to your private Paceline database and follows you to every device you
				sign in on. Export a copy any time.
			</p>
			<div class="flex flex-wrap gap-2.5">
				<Button icon="download" disabled={!workspace.tier.dataTools} onclick={exportData}
					>Export JSON</Button
				>
				<Button
					icon="upload"
					disabled={!workspace.tier.dataTools}
					onclick={() => fileInput?.click()}>Import JSON</Button
				>
				<input
					bind:this={fileInput}
					type="file"
					accept="application/json,.json"
					class="hidden"
					onchange={importData}
				/>
				<ConfirmButton
					label="Clear completed tasks"
					confirmLabel="Confirm: delete {workspace.tasks.filter((t) => t.status === 'done')
						.length} completed"
					onconfirm={() =>
						toast(`Deleted ${workspace.clearCompleted()} completed tasks`, {
							action: 'Undo',
							onAction: () => workspace.undo()
						})}
				/>
			</div>
			<div class="flex flex-wrap gap-2.5 border-t border-line pt-4">
				<ConfirmButton
					label="Reset to example plan"
					confirmLabel="Confirm: replace everything"
					onconfirm={() => (workspace.start('example'), toast('Example plan loaded'))}
				/>
				<ConfirmButton
					label="Start blank"
					confirmLabel="Confirm: erase everything"
					onconfirm={() => (workspace.start('blank'), toast('Blank plan ready'))}
				/>
			</div>
		</div>
	</Panel>

	<Panel title="Plan">
		<div class="grid gap-3 p-[18px] sm:grid-cols-3">
			{#each Object.values(TIERS) as t (t.id)}
				<div
					class="flex flex-col gap-2 border p-3 {t.id === auth.user?.tier
						? 'border-accent'
						: 'border-line'}"
				>
					<span class="flex items-center justify-between gap-2">
						<PlanBadge kind={t.id} />
						{#if t.id === auth.user?.tier}<span class="eyebrow text-[9.5px]">Current</span>{/if}
					</span>
					{#each t.perks as p (p)}<span class="text-[13px] text-ink-3">{p}</span>{/each}
				</div>
			{/each}
		</div>
	</Panel>

	<Panel title="Account">
		<div class="flex flex-col gap-4 p-[18px]">
			<form
				class="flex flex-wrap items-end gap-2.5"
				onsubmit={async (e) => {
					e.preventDefault();
					if (name.trim().length < 2) return;
					const r = await auth.rename(name.trim());
					toast(
						r.ok ? 'Name saved' : (r.error ?? 'Could not save the name'),
						r.ok ? {} : { tone: 'err' }
					);
				}}
			>
				<Field label="Name" class="min-w-60 flex-1"
					><input bind:value={name} class={input} autocomplete="name" /></Field
				>
				<Button type="submit">Save</Button>
			</form>
			<div class="font-mono text-xs text-muted">
				{auth.user?.username ? `@${auth.user.username} · permanent · ` : ''}{auth.user?.email}
			</div>
			<div class="flex flex-wrap gap-2.5 border-t border-line pt-4">
				<Button
					icon="logout"
					onclick={async () => {
						await auth.signOut();
						workspace.unload();
						goto('/login');
					}}>Sign out</Button
				>
				<ConfirmButton
					label="Delete account"
					confirmLabel="Confirm: delete account and plan"
					onconfirm={async () => {
						const r = await auth.deleteAccount();
						if (!r.ok) return toast(r.error ?? 'Could not delete the account', { tone: 'err' });
						workspace.unload();
						goto('/login');
					}}
				/>
			</div>
		</div>
	</Panel>
</div>
