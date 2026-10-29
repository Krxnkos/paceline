import type { ThemeChoice, ThemeId } from '../types.ts';

export const THEMES = [
	{
		id: 'carbon',
		label: 'Carbon',
		mode: 'dark',
		family: 'Volt',
		canvas: '#0B0C0E',
		surface: '#16181C',
		line: '#24272D',
		ink: '#F3F2ED',
		muted: '#8C929B',
		accent: '#D4FF3A'
	},
	{
		id: 'chalk',
		label: 'Chalk',
		mode: 'light',
		family: 'Volt',
		canvas: '#F3F2ED',
		surface: '#FBFAF7',
		line: '#DDDBD3',
		ink: '#0B0C0E',
		muted: '#5B616A',
		accent: '#D4FF3A'
	},
	{
		id: 'midnight',
		label: 'Midnight',
		mode: 'dark',
		family: 'Mint',
		canvas: '#070B14',
		surface: '#111826',
		line: '#1D2740',
		ink: '#EEF2FA',
		muted: '#8793AD',
		accent: '#4DF0B0'
	},
	{
		id: 'frost',
		label: 'Frost',
		mode: 'light',
		family: 'Mint',
		canvas: '#EEF2F5',
		surface: '#F8FAFB',
		line: '#D5DDE5',
		ink: '#0B1118',
		muted: '#566474',
		accent: '#2DD4A4'
	},
	{
		id: 'ember',
		label: 'Ember',
		mode: 'dark',
		family: 'Ember',
		canvas: '#0E0B09',
		surface: '#1A1512',
		line: '#2A221D',
		ink: '#F6EFE8',
		muted: '#9A8D80',
		accent: '#FF9A3D'
	},
	{
		id: 'sand',
		label: 'Sand',
		mode: 'light',
		family: 'Ember',
		canvas: '#F6EFE6',
		surface: '#FCF8F2',
		line: '#E0D5C6',
		ink: '#17110B',
		muted: '#6B5B4C',
		accent: '#FF8A1F'
	}
] as const;

/** Carbon↔Chalk, Midnight↔Frost, Ember↔Sand. The Insights reading slab uses the pair. */
export const PAIR: Record<ThemeId, ThemeId> = {
	carbon: 'chalk',
	chalk: 'carbon',
	midnight: 'frost',
	frost: 'midnight',
	ember: 'sand',
	sand: 'ember'
};

const IDS = THEMES.map((t) => t.id) as readonly string[];

class ThemeStore {
	choice = $state<ThemeChoice>('system');
	systemLight = $state(false);
	resolved = $derived<ThemeId>(
		this.choice === 'system' ? (this.systemLight ? 'chalk' : 'carbon') : this.choice
	);
	pair = $derived(PAIR[this.resolved]);

	init() {
		if (typeof window === 'undefined') return;
		try {
			const c = localStorage.getItem('pl-theme');
			if (c && (c === 'system' || IDS.includes(c))) this.choice = c as ThemeChoice;
		} catch {
			/* storage blocked */
		}
		const mq = matchMedia('(prefers-color-scheme: light)');
		this.systemLight = mq.matches;
		mq.addEventListener('change', (e) => {
			this.systemLight = e.matches;
			this.apply();
		});
		this.apply();
	}

	set(choice: ThemeChoice) {
		this.choice = choice;
		try {
			localStorage.setItem('pl-theme', choice);
		} catch {
			/* storage blocked */
		}
		this.apply();
	}

	apply() {
		if (typeof document === 'undefined') return;
		document.documentElement.dataset.theme = this.resolved;
		const meta = document.querySelector('meta[name="theme-color"]');
		meta?.setAttribute('content', THEMES.find((t) => t.id === this.resolved)!.canvas);
	}
}

export const theme = new ThemeStore();
