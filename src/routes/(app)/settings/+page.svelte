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
	import { CATEGORIES } from '#lib/types.ts';
	import type { Category, DayPattern, Reserved, Weekday } from '#lib/types.ts';
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
		else if (kind === 'uni') setPattern(d, { kind: 'uni' });
		else if (kind === 'personal') setPattern(d, { kind: 'personal', start: '09:00', end: '18:00' });
		else setPattern(d, { kind: 'off' });
	}

	const reserved = $derived(s.reserved ?? []);
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
							{ value: 'uni', label: 'University' },
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
						<span class="text-[13px] text-muted">No tasks are planned on University days</span>
					{/if}
				</div>
			{/each}
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
			<Field label="Focus block · minutes">
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
			<Field label="Focus timer" hint="Fit the block runs for the rest of the current block.">
				<Select
					value={s.focusMode ?? 'fixed'}
					options={[
						{ value: 'fixed', label: 'Set length' },
						{ value: 'fit', label: 'Fit the block' }
					]}
					onchange={(e) =>
						workspace.updateSettings({ focusMode: e.currentTarget.value as 'fixed' | 'fit' })}
				/>
			</Field>
			<Field label="Break · minutes">
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
							options={CATEGORIES.map((c) => ({ value: c, label: c }))}
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
					<label class="flex flex-col gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-muted"
						>MINUTES
						<input
							type="number"
							min="5"
							max="240"
							step="5"
							value={r.minutes}
							class="{input} w-24 font-mono"
							onchange={(e) => setReserved(r.id, { minutes: num(e.currentTarget.value, 5, 240) })}
						/></label
					>
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
									label: 'Admin',
									category: 'Admin',
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
