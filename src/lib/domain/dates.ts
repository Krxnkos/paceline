import type { DayPattern, HM, ISODate, Settings, Weekday } from '../types.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];
export const MONTH_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];
export const MONTH_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** Local calendar date of a Date as 'YYYY-MM-DD'. */
export function iso(d: Date): ISODate {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse 'YYYY-MM-DD' as local noon (immune to DST edges). */
export function parseISO(s: ISODate): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d, 12);
}

export function addDays(s: ISODate, n: number): ISODate {
	const d = parseISO(s);
	d.setDate(d.getDate() + n);
	return iso(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
	return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export function dow(s: ISODate): Weekday {
	return parseISO(s).getDay() as Weekday;
}

/** Monday of the week containing s. */
export function weekStart(s: ISODate): ISODate {
	const d = dow(s);
	return addDays(s, d === 0 ? -6 : 1 - d);
}

export function monthStart(s: ISODate): ISODate {
	return s.slice(0, 8) + '01';
}

export function addMonths(s: ISODate, n: number): ISODate {
	const d = parseISO(s);
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + n);
	const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
	d.setDate(Math.min(day, last));
	return iso(d);
}

/** ISO-8601 week number. */
export function weekNumber(s: ISODate): number {
	const d = parseISO(s);
	const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = t.getUTCDay() || 7;
	t.setUTCDate(t.getUTCDate() + 4 - day);
	const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
}

export function hmToMin(hm: HM): number {
	const [h, m] = hm.split(':').map(Number);
	return h * 60 + (m || 0);
}

export function minToHM(min: number): HM {
	const m = Math.max(0, Math.round(min));
	return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

export function nowMin(d: Date): number {
	return d.getHours() * 60 + d.getMinutes();
}

/** 90 → '1h 30m', 45 → '45m', 120 → '2h'. */
export function fmtDur(min: number): string {
	const m = Math.max(0, Math.round(min));
	const h = Math.floor(m / 60);
	const r = m % 60;
	if (!h) return `${r}m`;
	return r ? `${h}h ${r}m` : `${h}h`;
}

export function fmtHours(min: number, digits = 1): string {
	return (min / 60).toFixed(digits).replace(/\.0$/, '');
}

/** 'Wed 28 Oct' */
export function fmtShort(s: ISODate): string {
	const d = parseISO(s);
	return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** 'Wednesday 28 October' */
export function fmtLong(s: ISODate): string {
	const d = parseISO(s);
	return `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}

/** '28 Oct' */
export function fmtDayMonth(s: ISODate): string {
	const d = parseISO(s);
	return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** '29/10/2026' */
export function fmtNumeric(s: ISODate): string {
	const [y, m, d] = s.split('-');
	return `${d}/${m}/${y}`;
}

/** Relative wording used on cards: Today, Tomorrow, Friday, 16 Nov. */
export function fmtRelative(s: ISODate, today: ISODate): string {
	const n = diffDays(s, today);
	if (n === 0) return 'Today';
	if (n === 1) return 'Tomorrow';
	if (n === -1) return 'Yesterday';
	if (n > 1 && n < 7) return DOW_LONG[dow(s)];
	return fmtDayMonth(s);
}

export function patternFor(settings: Settings, s: ISODate): DayPattern {
	if (settings.leave.includes(s)) return { kind: 'off' };
	return settings.pattern[dow(s)];
}

export function isWorkday(settings: Settings, s: ISODate): boolean {
	return patternFor(settings, s).kind === 'work';
}

/** Working minutes of a day before buffer and meetings. */
export function dayWorkMinutes(p: DayPattern): number {
	if (p.kind !== 'work') return 0;
	let m = hmToMin(p.end) - hmToMin(p.start);
	if (p.lunch) m -= hmToMin(p.lunch[1]) - hmToMin(p.lunch[0]);
	return Math.max(0, m);
}

/** '26 October' */
export function fmtDayMonthLong(s: ISODate): string {
	const d = parseISO(s);
	return `${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
}
