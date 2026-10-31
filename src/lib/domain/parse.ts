import type { Category, HM, ISODate, Priority, Project, Repeat, StartMode } from '../types.ts';
import { addDays, dow, fmtShort, fmtDur, iso, parseISO } from './dates.ts';

export interface Chip {
	l: string;
	v: string;
}

export interface Parsed {
	kind: 'task' | 'meeting';
	title: string;
	imp?: Priority;
	cat?: Category;
	personal?: boolean;
	projectId?: string;
	newProject?: string;
	due?: ISODate;
	est?: number;
	start?: StartMode;
	startDate?: ISODate;
	repeat?: Repeat;
	quick?: boolean;
	mStart?: HM;
	mEnd?: HM;
	chips: Chip[];
}

export interface ParseContext {
	today: ISODate;
	projects: Pick<Project, 'id' | 'name'>[];
}

const CATS: [string, Category][] = [
	['deep', 'Deep Work'],
	['study', 'Study'],
	['admin', 'Admin'],
	['comms', 'Comms'],
	['review', 'Review']
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const EST_RE = /^(\d+(?:\.\d+)?)h(?:(\d+)m?)?$|^(\d+)m(?:in)?$/i;
const RANGE_RE = /^(\d{1,2}):?(\d{2})-(\d{1,2}):?(\d{2})$/;

/** Minutes from an estimate token: 90m, 1.5h, 1h30. Null when not an estimate. */
export function parseEstimate(w: string): number | null {
	const m = EST_RE.exec(w);
	if (!m) return null;
	if (m[3]) return Number(m[3]);
	return Math.round(Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
}

/** Resolve a date word (without the @ or ^) relative to today. */
export function parseDateWord(word: string, today: ISODate): ISODate | null {
	const w = word.toLowerCase();
	if (w === 'today' || w === 'tod') return today;
	if (w === 'tomorrow' || w === 'tmr' || w === 'tom') return addDays(today, 1);
	if (/^\+\d+$/.test(w)) return addDays(today, Number(w.slice(1)));
	if (/^\+\d+w$/.test(w)) return addDays(today, Number(w.slice(1, -1)) * 7);
	if (w === 'eow') {
		const d = dow(today);
		return addDays(today, d <= 5 ? 5 - d : 6);
	}
	if (w === 'eom') {
		const d = parseISO(today);
		return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
	const di = w.length >= 3 ? DAYS_FULL.findIndex((d) => d.startsWith(w)) : -1;
	if (di >= 0) {
		const delta = (di - dow(today) + 7) % 7;
		return addDays(today, delta);
	}
	// 16oct · 16-oct · oct16
	let m = /^(\d{1,2})-?([a-z]{3})[a-z]*$/.exec(w) ?? null;
	let day: number | null = null;
	let mon = -1;
	if (m) {
		day = Number(m[1]);
		mon = MONTHS.indexOf(m[2]);
	} else if ((m = /^([a-z]{3})[a-z]*-?(\d{1,2})$/.exec(w))) {
		day = Number(m[2]);
		mon = MONTHS.indexOf(m[1]);
	} else if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(w))) {
		day = Number(m[1]);
		mon = Number(m[2]) - 1;
	}
	if (day !== null && mon >= 0 && mon < 12 && day >= 1 && day <= 31) {
		const t = parseISO(today);
		let cand = new Date(t.getFullYear(), mon, day, 12);
		if (iso(cand) < today) cand = new Date(t.getFullYear() + 1, mon, day, 12);
		return iso(cand);
	}
	return null;
}

const DAYS_FULL: string[] = [
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday'
];

function normaliseHM(h: string, m: string): HM {
	return `${h.padStart(2, '0')}:${m}`;
}

/**
 * Smart capture. Tokens:
 * !1…!5 priority · #deep #study #admin #comms #review category · +Project_Name project
 * @fri @16oct @+3 @eow @eom due · 90m 1.5h 1h30 estimate · ^asap ^manual ^mon start
 * ~daily ~weekly ~fortnightly ~monthly repeat · leading `qw` quick win · leading `mtg` + 10:00-10:30 meeting
 */
export function parseCapture(text: string, ctx: ParseContext): Parsed {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const out: Parsed = { kind: 'task', title: '', chips: [] };
	const title: string[] = [];

	if (words.length && /^qw$/i.test(words[0])) {
		out.quick = true;
		words.shift();
	} else if (words.length && /^mtg$/i.test(words[0])) {
		out.kind = 'meeting';
		words.shift();
	}

	for (const w of words) {
		let m: RegExpExecArray | null;
		if ((m = /^!([1-5])$/.exec(w))) {
			out.imp = Number(m[1]) as Priority;
			continue;
		}
		if (w.length > 1 && w[0] === '#') {
			const key = w.slice(1).toLowerCase();
			if (key === 'personal') {
				out.personal = true;
				continue;
			}
			const hit = CATS.find(([k]) => k.startsWith(key) || key.startsWith(k));
			if (hit) {
				out.cat = hit[1];
				continue;
			}
		}
		if (w.length > 1 && w[0] === '+') {
			const name = w.slice(1).replace(/_/g, ' ');
			const p =
				ctx.projects.find((p) => p.name.toLowerCase() === name.toLowerCase()) ??
				ctx.projects.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase()));
			if (p) out.projectId = p.id;
			else out.newProject = name;
			continue;
		}
		if (w.length > 1 && w[0] === '@') {
			const d = parseDateWord(w.slice(1), ctx.today);
			if (d) {
				out.due = d;
				continue;
			}
		}
		if (w.length > 1 && w[0] === '^') {
			const key = w.slice(1).toLowerCase();
			if (key === 'asap' || key === 'manual' || key === 'auto') {
				out.start = key;
				continue;
			}
			const d = parseDateWord(key, ctx.today);
			if (d) {
				out.start = 'date';
				out.startDate = d;
				continue;
			}
		}
		if (w.length > 1 && w[0] === '~') {
			const key = w.slice(1).toLowerCase();
			const r = (['daily', 'weekly', 'fortnightly', 'monthly'] as const).find((r) =>
				r.startsWith(key)
			);
			if (r) {
				out.repeat = r;
				continue;
			}
		}
		if (out.kind === 'meeting' && (m = RANGE_RE.exec(w))) {
			out.mStart = normaliseHM(m[1], m[2]);
			out.mEnd = normaliseHM(m[3], m[4]);
			continue;
		}
		const est = parseEstimate(w);
		if (est !== null && out.kind === 'task') {
			out.est = est;
			continue;
		}
		title.push(w);
	}

	out.title = title.join(' ');
	const projectName = out.projectId
		? ctx.projects.find((p) => p.id === out.projectId)?.name
		: out.newProject
			? `${out.newProject} (new)`
			: undefined;

	const c = out.chips;
	if (out.kind === 'meeting') c.push({ l: 'Type', v: 'Meeting' });
	else if (out.quick) c.push({ l: 'Type', v: 'Quick win' });
	if (out.title) c.push({ l: 'Title', v: out.title });
	if (projectName) c.push({ l: 'Proj', v: projectName });
	if (out.due) c.push({ l: out.kind === 'meeting' ? 'Date' : 'Due', v: fmtShort(out.due) });
	if (out.mStart && out.mEnd) c.push({ l: 'Time', v: `${out.mStart}–${out.mEnd}` });
	if (out.est) c.push({ l: 'Est', v: fmtDur(out.est) });
	if (out.cat) c.push({ l: 'Cat', v: out.cat });
	if (out.personal) c.push({ l: 'Scope', v: 'Personal' });
	if (out.imp) c.push({ l: 'Pri', v: `P${out.imp}` });
	if (out.start && out.start !== 'auto')
		c.push({
			l: 'Start',
			v: out.start === 'date' && out.startDate ? fmtShort(out.startDate) : out.start.toUpperCase()
		});
	if (out.repeat) c.push({ l: 'Repeat', v: out.repeat });
	return out;
}

export const SYNTAX_REFERENCE: { token: string; meaning: string }[] = [
	{ token: '!1 … !5', meaning: 'Priority' },
	{ token: '#deep #study #admin #comms #review', meaning: 'Category' },
	{ token: '#personal', meaning: 'Personal task (Pro)' },
	{ token: '+Project_Name', meaning: 'Project, new if unknown' },
	{ token: '@fri @16oct @+3 @eow @eom', meaning: 'Due date' },
	{ token: '90m 1.5h 1h30', meaning: 'Estimate' },
	{ token: '^asap ^manual ^mon', meaning: 'Start mode' },
	{ token: '~daily ~weekly ~monthly', meaning: 'Repeat' },
	{ token: 'qw … / mtg … 10:00-10:30', meaning: 'Quick win / meeting' }
];
