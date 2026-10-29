/** 24×24 stroke paths. Rendered by Icon.svelte with currentColor. */
export const ICONS = {
	today: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
	inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
	week: '<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4"/>',
	table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M3 15h18M9 4v16"/>',
	board:
		'<rect x="4" y="4" width="4" height="16"/><rect x="10" y="4" width="4" height="11"/><rect x="16" y="4" width="4" height="7"/>',
	timeline: '<path d="M4 6h9M7 12h11M10 18h8"/>',
	calendar:
		'<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M16 14h0M8 17h2"/>',
	projects: '<path d="M3 7h7l2 2h9v10H3z"/>',
	goals:
		'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>',
	insights: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
	settings:
		'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
	focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4M9 2h6"/>',
	bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
	repeat:
		'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
	link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
	lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
	bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
	edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
	trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
	logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
	check: '<path d="M5 12l5 5 9-10"/>',
	x: '<path d="M6 6l12 12M18 6L6 18"/>',
	menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
	chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
	chevronRight: '<path d="M9 6l6 6-6 6"/>',
	chevronDown: '<path d="M6 9l6 6 6-6"/>',
	arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
	undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
	play: '<path d="M7 4l13 8-13 8z"/>',
	pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
	clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	meeting:
		'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.6 3 6"/>',
	key: '<circle cx="8" cy="9" r="4"/><path d="M2 20c0-3.3 2.7-6 6-6M14 11l7 7M18 15l2-2M16 13l1.5-1.5"/>',
	sso: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M8 14h4"/>',
	mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/>',
	download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
	upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
	keyboard:
		'<rect x="2" y="6" width="20" height="12"/><path d="M6 10h0M10 10h0M14 10h0M18 10h0M7 14h10"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
	flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
	minimise: '<path d="M4 14h6v6M20 10h-6V4"/>'
} as const;

export type IconName = keyof typeof ICONS;
