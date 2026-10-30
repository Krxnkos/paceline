import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

/** Names that could pass for staff or the product. */
const RESERVED =
	/^(admin|administrator|root|system|sysadmin|support|help|staff|mod|moderator|developer|dev|owner|official|paceline|krxnkos|security|billing|api|null|undefined|anonymous|deleted|me|you|everyone)$/;

/** Hate terms the general profanity dataset doesn't cover. */
const EXTRA_BLOCKED = /(hitler|nazi|kkk|isis|whitepower|heilh|genocide|pedo|paedo|rapist)/;

let matcher: RegExpMatcher | null = null;

function offensive(name: string): boolean {
	matcher ??= new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
	// Also check with separators gone, so f_u_c_k can't slip through.
	const joined = name.replace(/_/g, '');
	const lettersOnly = joined
		.replace(/0/g, 'o')
		.replace(/1/g, 'i')
		.replace(/3/g, 'e')
		.replace(/4/g, 'a')
		.replace(/5/g, 's')
		.replace(/7/g, 't');
	return [name, joined, lettersOnly].some((v) => matcher!.hasMatch(v) || EXTRA_BLOCKED.test(v));
}

/** Returns the stored form of a username, or why it can't be used. */
export function checkUsername(
	input: unknown
): { ok: true; username: string } | { ok: false; error: string } {
	if (typeof input !== 'string') return { ok: false, error: 'Choose a username.' };
	const username = input.trim().replace(/^@/, '').toLowerCase();
	if (!/^[a-z][a-z0-9_]{2,19}$/.test(username))
		return {
			ok: false,
			error: 'Use 3–20 letters, numbers or underscores, starting with a letter.'
		};
	if (RESERVED.test(username)) return { ok: false, error: 'That username is reserved.' };
	if (offensive(username))
		return { ok: false, error: 'That username isn’t allowed. Choose something else.' };
	return { ok: true, username };
}
