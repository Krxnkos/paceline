import type { Category, Task } from '../types.ts';

/** Shared filter state for the FilterBar on Table, Board, Timeline and Calendar. */
class Filters {
	q = $state('');
	project = $state<string>('all'); // 'all' | 'none' | projectId
	category = $state<Category | 'all'>('all');
	showDone = $state(true);

	active = $derived(
		this.q !== '' || this.project !== 'all' || this.category !== 'all' || !this.showDone
	);

	match = (t: Task): boolean => {
		if (!this.showDone && t.status === 'done') return false;
		if (this.project === 'none' && t.projectId) return false;
		if (this.project !== 'all' && this.project !== 'none' && t.projectId !== this.project)
			return false;
		if (this.category !== 'all' && t.category !== this.category) return false;
		if (this.q) {
			const q = this.q.toLowerCase();
			const hay = `${t.title} ${t.notes ?? ''} T-${String(t.code).padStart(3, '0')}`.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	};

	reset() {
		this.q = '';
		this.project = 'all';
		this.category = 'all';
		this.showDone = true;
	}
}

export const filters = new Filters();
