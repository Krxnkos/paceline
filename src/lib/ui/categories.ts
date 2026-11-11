import type { CategoryColor } from '../types.ts';
import { DEFAULT_CATEGORIES } from '../types.ts';
import { workspace } from '../stores/workspace.svelte.ts';

/** Swatch and border classes for each category colour. */
export const CAT_BG: Record<CategoryColor, string> = {
	ink: 'bg-ink',
	faint: 'bg-faint',
	accent: 'bg-accent-text',
	ice: 'bg-ice',
	lilac: 'bg-lilac',
	amber: 'bg-amber',
	flare: 'bg-flare'
};

export const CAT_BORDER: Record<CategoryColor, string> = {
	ink: 'border-ink',
	faint: 'border-faint',
	accent: 'border-accent-text',
	ice: 'border-ice',
	lilac: 'border-lilac',
	amber: 'border-amber',
	flare: 'border-flare'
};

export const CAT_COLORS = Object.keys(CAT_BG) as CategoryColor[];

function colorOf(name: string): CategoryColor {
	const list = workspace.data ? workspace.categories : DEFAULT_CATEGORIES;
	return list.find((c) => c.name === name)?.color ?? 'faint';
}

/** Background class for a category's dot or bar. */
export const catSwatch = (name: string) => CAT_BG[colorOf(name)];
/** Border class for a category's accent edge. */
export const catBorder = (name: string) => CAT_BORDER[colorOf(name)];
