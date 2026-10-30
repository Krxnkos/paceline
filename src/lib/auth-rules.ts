/** Shared by the sign-up screen and the server. */
export const PW_RULES = [
	{ label: '12+ characters', test: (p: string) => p.length >= 12 },
	{ label: 'A number', test: (p: string) => /\d/.test(p) },
	{ label: 'Upper + lower case', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
	{ label: 'A symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) }
];

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
