import { describe, expect, it } from 'vitest';
import { addDays, fmtDur, weekStart } from './dates.ts';
import { parseCapture, parseDateWord, parseEstimate } from './parse.ts';
import { buildPlan, dayCapacity } from './plan.ts';
import { forecast, mustDos, urgency } from './forecast.ts';
import { defaultSettings, exampleWorkspace, newTask } from './seed.ts';
import { projectStats } from './stats.ts';

// Wednesday 28 October 2026, 10:19
const NOW = new Date(2026, 9, 28, 10, 19);
const TODAY = '2026-10-28';
const ctx = { today: TODAY, projects: [{ id: 'p1', name: 'Test Fixture Rev B' }] };

describe('dates', () => {
	it('finds the Monday of a week', () => {
		expect(weekStart(TODAY)).toBe('2026-10-26');
		expect(weekStart('2026-11-01')).toBe('2026-10-26');
	});
	it('formats durations', () => {
		expect(fmtDur(99)).toBe('1h 39m');
		expect(fmtDur(45)).toBe('45m');
		expect(fmtDur(120)).toBe('2h');
	});
});

describe('parse', () => {
	it('reads estimates', () => {
		expect(parseEstimate('90m')).toBe(90);
		expect(parseEstimate('1.5h')).toBe(90);
		expect(parseEstimate('1h30')).toBe(90);
		expect(parseEstimate('2h')).toBe(120);
		expect(parseEstimate('fixture')).toBeNull();
	});

	it('reads date words', () => {
		expect(parseDateWord('fri', TODAY)).toBe('2026-10-30');
		expect(parseDateWord('+3', TODAY)).toBe('2026-10-31');
		expect(parseDateWord('16nov', TODAY)).toBe('2026-11-16');
		expect(parseDateWord('eow', TODAY)).toBe('2026-10-30');
		expect(parseDateWord('eom', TODAY)).toBe('2026-10-31');
		expect(parseDateWord('tomorrow', TODAY)).toBe('2026-10-29');
	});

	it('parses a full capture line', () => {
		const p = parseCapture('Draft report !2 #deep @fri 90m +Test_Fixture_Rev_B ~weekly ^asap', ctx);
		expect(p).toMatchObject({
			kind: 'task',
			title: 'Draft report',
			imp: 2,
			cat: 'Deep Work',
			due: '2026-10-30',
			est: 90,
			projectId: 'p1',
			repeat: 'weekly',
			start: 'asap'
		});
		expect(p.chips.map((c) => c.l)).toContain('Proj');
	});

	it('flags unknown projects as new', () => {
		expect(parseCapture('Bench test +Line_3', ctx).newProject).toBe('Line 3');
	});

	it('parses quick wins and meetings', () => {
		expect(parseCapture('qw File expenses 10m', ctx)).toMatchObject({
			quick: true,
			title: 'File expenses',
			est: 10
		});
		expect(parseCapture('mtg Design review 13:00-14:00 @fri', ctx)).toMatchObject({
			kind: 'meeting',
			title: 'Design review',
			mStart: '13:00',
			mEnd: '14:00',
			due: '2026-10-30'
		});
	});
});

describe('plan', () => {
	const settings = defaultSettings(TODAY);

	it('keeps the buffer free', () => {
		// Wednesday: 07:45–16:45 less 30 min lunch = 510 min; 20% buffer → 408.
		expect(dayCapacity(settings, [], TODAY)).toBe(408);
	});

	it('never schedules in the past, on University days or at weekends', () => {
		const t = newTask(1, TODAY, { estimateMin: 2000, title: 'Big' });
		const plan = buildPlan([t], [], settings, NOW);
		for (const b of plan.blocks) {
			if (b.date === TODAY) expect(b.start).toBeGreaterThanOrEqual(10 * 60 + 15); // current quarter-hour
			expect(['2026-10-27', '2026-10-31', '2026-11-01', '2026-11-03']).not.toContain(b.date);
		}
		expect(plan.placed[t.id]).not.toBeNull();
	});

	it('avoids meetings and lunch', () => {
		const t = newTask(1, TODAY, { estimateMin: 300 });
		const m = { id: 'm', title: 'Review', date: TODAY, start: '13:00', end: '14:00' };
		const plan = buildPlan([t], [m], settings, NOW);
		for (const b of plan.byDate[TODAY]) {
			expect(b.end <= 12 * 60 || b.start >= 12 * 60 + 30).toBe(true);
			expect(b.end <= 13 * 60 || b.start >= 14 * 60).toBe(true);
		}
	});

	it('schedules after dependencies finish', () => {
		const a = newTask(1, TODAY, { id: 'a', estimateMin: 300, priority: 5 });
		const b = newTask(2, TODAY, { id: 'b', estimateMin: 60, priority: 1, deps: ['a'] });
		const plan = buildPlan([a, b], [], settings, NOW);
		const pa = plan.placed.a!;
		const pb = plan.placed.b!;
		expect(pb.startDate >= pa.endDate).toBe(true);
		if (pb.startDate === pa.endDate) expect(pb.blocks[0].start).toBeGreaterThanOrEqual(pa.endMin);
	});

	it('leaves quick wins, inbox and manual tasks unscheduled', () => {
		const ts = [
			newTask(1, TODAY, { quick: true }),
			newTask(2, TODAY, { inbox: true }),
			newTask(3, TODAY, { start: 'manual' })
		];
		expect(buildPlan(ts, [], settings, NOW).blocks).toHaveLength(0);
	});
});

describe('forecast', () => {
	it('labels urgency', () => {
		const t = (due: string | null) => newTask(1, TODAY, { due });
		expect(urgency(t('2026-10-27'), TODAY).label).toBe('Overdue');
		expect(urgency(t(TODAY), TODAY).label).toBe('Due today');
		expect(urgency(t('2026-10-30'), TODAY).label).toBe('Due soon');
		expect(urgency(t('2026-11-01'), TODAY).label).toBe('This week');
		expect(urgency(t(null), TODAY).label).toBe('No date');
	});

	it('flags late forecasts', () => {
		const t = newTask(1, TODAY, { estimateMin: 1200, due: addDays(TODAY, 1) });
		const plan = buildPlan([t], [], defaultSettings(TODAY), NOW);
		expect(forecast(t, plan)?.tone).toBe('late');
	});
});

describe('example workspace', () => {
	const ws = exampleWorkspace(TODAY);
	const plan = buildPlan(ws.tasks, ws.meetings, ws.settings, NOW);

	it('plans every schedulable task', () => {
		expect(plan.blocks.length).toBeGreaterThan(5);
	});

	it('picks five must-dos', () => {
		expect(mustDos(ws.tasks, plan, TODAY)).toHaveLength(5);
	});

	it('computes project stats', () => {
		const s = projectStats(ws.projects[0], ws.tasks, plan);
		expect(s.pct).toBeGreaterThan(0);
		expect(s.pct).toBeLessThan(1);
	});
});
