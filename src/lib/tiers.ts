/** Plans and what each unlocks. Shared by the server (limits) and the screens. */
export type Tier = 'free' | 'pro' | 'ultimate';

export interface TierInfo {
	id: Tier;
	label: string;
	projects: number;
	goals: number;
	themes: 'basic' | 'all';
	insightWeeks: number;
	timeline: boolean;
	dataTools: boolean;
	perks: string[];
}

export const TIERS: Record<Tier, TierInfo> = {
	free: {
		id: 'free',
		label: 'Free',
		projects: 5,
		goals: 3,
		themes: 'basic',
		insightWeeks: 4,
		timeline: false,
		dataTools: false,
		perks: ['5 projects, 3 goals', 'Carbon and Chalk themes', '4-week forecast']
	},
	pro: {
		id: 'pro',
		label: 'Pro',
		projects: Infinity,
		goals: Infinity,
		themes: 'all',
		insightWeeks: 12,
		timeline: true,
		dataTools: false,
		perks: ['Unlimited projects and goals', 'All six themes', '12-week forecast', 'Timeline view']
	},
	ultimate: {
		id: 'ultimate',
		label: 'Ultimate',
		projects: Infinity,
		goals: Infinity,
		themes: 'all',
		insightWeeks: 26,
		timeline: true,
		dataTools: true,
		perks: ['Everything in Pro', '26-week forecast', 'JSON export and import']
	}
};

/** The plan in force now: a timed grant falls back to Free when it runs out. */
export function effectiveTier(u: { tier?: unknown; tierExpiresAt?: Date | string | null }): Tier {
	const t = TIERS[u.tier as Tier] ? (u.tier as Tier) : 'free';
	return u.tierExpiresAt && new Date(u.tierExpiresAt).getTime() <= Date.now() ? 'free' : t;
}

export const tierInfo = (t: unknown): TierInfo => TIERS[t as Tier] ?? TIERS.free;
