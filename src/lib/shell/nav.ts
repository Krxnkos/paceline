import type { IconName } from '../ui/icons.ts';

export interface NavEntry {
	href: string;
	label: string;
	icon: IconName;
	index: string;
	sub: string;
	key: string; // G + key
}

export const NAV: { group: string; items: NavEntry[] }[] = [
	{
		group: 'Plan',
		items: [
			{
				href: '/today',
				label: 'Today',
				icon: 'today',
				index: '01',
				sub: 'One lit block at a time',
				key: 't'
			},
			{
				href: '/inbox',
				label: 'Inbox',
				icon: 'inbox',
				index: '02',
				sub: 'Triage what you captured',
				key: 'i'
			},
			{
				href: '/week',
				label: 'Week',
				icon: 'week',
				index: '03',
				sub: 'Five days in formation',
				key: 'w'
			},
			{
				href: '/review',
				label: 'Weekly review',
				icon: 'review',
				index: '14',
				sub: 'Clear, current, creative',
				key: 'r'
			}
		]
	},
	{
		group: 'Views',
		items: [
			{
				href: '/table',
				label: 'Table',
				icon: 'table',
				index: '04',
				sub: 'Every task, sortable',
				key: 'a'
			},
			{
				href: '/board',
				label: 'Board',
				icon: 'board',
				index: '05',
				sub: 'Flow work through stages',
				key: 'b'
			},
			{
				href: '/timeline',
				label: 'Timeline',
				icon: 'timeline',
				index: '06',
				sub: 'Projects across time',
				key: 'l'
			},
			{
				href: '/calendar',
				label: 'Calendar',
				icon: 'calendar',
				index: '07',
				sub: 'The month at a glance',
				key: 'c'
			},
			{
				href: '/matrix',
				label: 'Matrix',
				icon: 'matrix',
				index: '13',
				sub: 'Urgent against important',
				key: 'm'
			}
		]
	},
	{
		group: 'Track',
		items: [
			{
				href: '/projects',
				label: 'Projects',
				icon: 'projects',
				index: '08',
				sub: 'Who’s at the front',
				key: 'p'
			},
			{
				href: '/goals',
				label: 'Goals',
				icon: 'goals',
				index: '09',
				sub: 'Pace against a straight line',
				key: 'o'
			},
			{
				href: '/insights',
				label: 'Insights',
				icon: 'insights',
				index: '10',
				sub: 'How the time went',
				key: 's'
			}
		]
	}
];

export const SETTINGS_NAV: NavEntry = {
	href: '/settings',
	label: 'Settings',
	icon: 'settings',
	index: '11',
	sub: 'Your pace, your rules',
	key: ','
};

export const CONSOLE_NAV: NavEntry = {
	href: '/console',
	label: 'Developer',
	icon: 'terminal',
	index: '12',
	sub: 'Accounts, commands and diagnostics',
	key: ''
};

export const ALL_NAV: NavEntry[] = [...NAV.flatMap((g) => g.items), SETTINGS_NAV];

export function navFor(path: string): NavEntry | undefined {
	return [...ALL_NAV, CONSOLE_NAV].find((n) => path === n.href || path.startsWith(n.href + '/'));
}
