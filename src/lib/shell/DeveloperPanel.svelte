<script lang="ts">
	import Panel from '../ui/Panel.svelte';
	import Button from '../ui/Button.svelte';
	import { api, auth } from '../stores/auth.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { focus } from '../stores/focus.svelte.ts';
	import { theme } from '../stores/theme.svelte.ts';
	import { toast } from '../stores/toast.svelte.ts';
	import { input } from '../ui/styles.ts';

	let server = $state<unknown>(null);
	let travelTo = $state('');

	const diagnostics = $derived({
		user: auth.user,
		sync: { state: workspace.saving, version: workspace.version, status: workspace.status },
		clock: { now: clock.now.toString(), offsetMs: clock.offset },
		blocks: { active: workspace.active, awaiting: workspace.awaiting },
		plan: {
			blocks: workspace.plan.blocks.length,
			beyond: workspace.plan.beyond.length,
			tasks: workspace.tasks.length
		},
		focus: focus.state,
		theme: theme.resolved,
		alerts: workspace.alerts.length,
		app: { agent: navigator.userAgent, online: navigator.onLine }
	});
	const text = $derived(JSON.stringify({ ...diagnostics, server }, null, 2));

	async function ping() {
		const r = await api('GET', '/api/debug');
		server = r.ok ? r.data : { error: r.error, status: r.status };
	}
</script>

<Panel title="Developer" meta="Debug tools">
	<div class="flex flex-col gap-4 p-[18px]">
		<div class="flex flex-wrap gap-2.5">
			<Button onclick={ping}>Ping server</Button>
			<Button onclick={() => workspace.tick()}>Run block tick</Button>
			<Button disabled={!workspace.active} onclick={() => workspace.endActiveNow()}
				>End lit block now</Button
			>
			<Button
				onclick={async () => {
					await navigator.clipboard.writeText(text);
					toast('Diagnostics copied');
				}}>Copy diagnostics</Button
			>
		</div>
		<div class="flex flex-wrap items-end gap-2.5">
			<label class="flex flex-col gap-2">
				<span class="eyebrow">Time travel (this tab)</span>
				<input
					type="datetime-local"
					bind:value={travelTo}
					class="{input} w-64 font-mono text-[13px]"
				/>
			</label>
			<Button disabled={!travelTo} onclick={() => clock.travel(new Date(travelTo))}>Go</Button>
			<Button onclick={() => clock.travel(null)}>Real time</Button>
		</div>
		<pre
			class="m-0 max-h-80 overflow-auto border border-line bg-panel p-3 font-mono text-[11px] leading-relaxed text-ink-2">{text}</pre>
	</div>
</Panel>
