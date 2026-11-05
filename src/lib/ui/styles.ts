import type { Category, LabelColor, Tone } from '../types.ts';

/** Shared class strings so every field looks the same. */
export const input =
	'h-10 w-full rounded-xs border border-line-2 bg-surface px-3 text-[14px] text-ink placeholder:text-faint hover:border-line-3 focus:border-ink-3 focus:outline-none aria-[invalid=true]:border-flare';
export const inputLg =
	'h-12 w-full rounded-xs border border-line-3 bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-flare';
export const select = `${input} appearance-none pr-8 bg-[length:10px] bg-no-repeat bg-[right_10px_center] cursor-pointer`;
export const label = 'font-mono text-[10.5px] font-medium tracking-[0.14em] text-muted uppercase';
export const panelHead =
	'flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase';

export const toneText: Record<Tone, string> = {
	late: 'text-flare',
	warn: 'text-amber',
	info: 'text-ice',
	lead: 'text-accent-text',
	plain: 'text-ink-3',
	mute: 'text-muted'
};

export const toneBg: Record<Tone, string> = {
	late: 'bg-flare',
	warn: 'bg-amber',
	info: 'bg-ice',
	lead: 'bg-accent',
	plain: 'bg-ink-3',
	mute: 'bg-muted'
};

export const catSwatch: Record<Category, string> = {
	'Deep Work': 'bg-ink',
	Study: 'bg-lilac',
	Admin: 'bg-faint',
	Comms: 'bg-amber',
	Review: 'bg-ice'
};

export const catBorder: Record<Category, string> = {
	'Deep Work': 'border-ink',
	Study: 'border-lilac',
	Admin: 'border-faint',
	Comms: 'border-amber',
	Review: 'border-ice'
};

export const labelCls: Record<LabelColor, string> = {
	ink: 'border-ink-3 text-ink',
	accent: 'border-accent-text text-accent-text',
	ice: 'border-ice text-ice',
	lilac: 'border-lilac text-lilac',
	amber: 'border-amber text-amber',
	flare: 'border-flare text-flare'
};

/** Solid colour for a label's strip on calendar blocks. */
export const labelBar: Record<LabelColor, string> = {
	ink: 'bg-ink-3',
	accent: 'bg-accent-text',
	ice: 'bg-ice',
	lilac: 'bg-lilac',
	amber: 'bg-amber',
	flare: 'bg-flare'
};
