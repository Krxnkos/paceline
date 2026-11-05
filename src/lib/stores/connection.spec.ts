import { describe, expect, it } from 'vitest';
import { safeNext } from './connection.svelte.ts';

const at = (q: string) => new URL(`https://paceline.krxnkos.xyz/login${q}`);

describe('safeNext', () => {
	it('returns to a page on this site', () => {
		expect(safeNext(at('?next=%2Fweek%3Ftask%3DT-014'))).toBe('/week?task=T-014');
	});

	it('never leaves the site or loops back to sign-in', () => {
		for (const q of [
			'?next=https%3A%2F%2Fevil.example',
			'?next=%2F%2Fevil.example',
			'?next=%2F%5Cevil.example',
			'?next=javascript%3Aalert(1)',
			'?next=%2Flogin',
			''
		])
			expect(safeNext(at(q))).toBe('/today');
	});
});
