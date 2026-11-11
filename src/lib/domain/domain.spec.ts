import { describe, expect, it } from 'vitest';
import { addDays, fmtDur, weekStart } from './dates.ts';
import { parseCapture, parseDateWord, parseEstimate } from './parse.ts';
import { awayLabel } from './dates.ts';
import { buildPlan, dayCapacity, isPersonalDay, remainingMin, reservedSlots } from './plan.ts';
import {
	blockers,
	forecast,
	frogOf,
	ivyList,
	mustDos,
	oneThreeFive,
	quadrantOf,
	urgency
} from './forecast.ts';
import { defaultSettings, exampleSettings, exampleWorkspace, newTask } from './seed.ts';
import { dailyFocus, projectStats } from './stats.ts';

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
	const settings = exampleSettings();

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

	it('leaves inbox and manual tasks unscheduled, and quick wins out of the main plan', () => {
		const ts = [
			newTask(1, TODAY, { quick: true, start: 'manual' }),
			newTask(2, TODAY, { inbox: true }),
			newTask(3, TODAY, { start: 'manual' }),
			newTask(4, TODAY, { quick: true })
		];
		const plan = buildPlan(ts, [], { ...settings, fillQuickWins: false }, NOW);
		expect(plan.blocks).toHaveLength(0);
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
		const plan = buildPlan([t], [], exampleSettings(), NOW);
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

describe('blocks that happened', () => {
	const settings = exampleSettings();

	it('keeps a lit block fixed and counts it towards the task', () => {
		const t = newTask(1, TODAY, { id: 'a', estimateMin: 90 });
		const active = { taskId: 'a', date: TODAY, start: 600, end: 660 };
		const plan = buildPlan([t], [], settings, NOW, active);
		expect(plan.placed.a!.blocks[0]).toMatchObject({ start: 600, end: 660 });
		const total = plan.placed.a!.blocks.reduce((n, b) => n + b.end - b.start, 0);
		expect(total).toBe(90);
	});

	it('does not schedule over finished blocks', () => {
		const done = newTask(1, TODAY, {
			status: 'done',
			history: [{ date: TODAY, start: 660, end: 690 }]
		});
		const t = newTask(2, TODAY, { id: 'b', estimateMin: 120 });
		for (const b of buildPlan([done, t], [], settings, NOW).byDate[TODAY])
			expect(b.end <= 660 || b.start >= 690).toBe(true);
	});

	it('counts time from earlier blocks of a split task', () => {
		expect(remainingMin(newTask(1, TODAY, { estimateMin: 120, creditMin: 90 }))).toBe(30);
	});
});

describe('personal tasks', () => {
	const settings = {
		...exampleSettings(),
		pattern: {
			...exampleSettings().pattern,
			4: { kind: 'personal', start: '10:00', end: '16:00' }
		}
	} as ReturnType<typeof exampleSettings>;

	it('runs personal tasks only on Personal and non-working days', () => {
		const t = newTask(1, TODAY, { id: 'p', scope: 'personal', estimateMin: 900 });
		const blocks = buildPlan([t], [], settings, NOW).placed.p!.blocks;
		for (const b of blocks) expect(isPersonalDay(settings, b.date)).toBe(true);
		expect(blocks[0].date).toBe('2026-10-29'); // Thursday, set to Personal
		expect(blocks[0].start).toBe(600);
	});

	it('never runs work tasks on those days', () => {
		const t = newTask(1, TODAY, { id: 'w', estimateMin: 2000 });
		for (const b of buildPlan([t], [], settings, NOW).placed.w!.blocks)
			expect(isPersonalDay(settings, b.date)).toBe(false);
	});

	it('reads #personal in capture', () => {
		const p = parseCapture('Book dentist #personal 30m', ctx);
		expect(p).toMatchObject({ title: 'Book dentist', personal: true, est: 30 });
	});
});

describe('reserved time', () => {
	const settings = {
		...exampleSettings(),
		reserved: [
			{
				id: 'r1',
				label: 'Admin',
				category: 'Admin' as const,
				start: 'start' as const,
				minutes: 20,
				days: [1, 2, 3, 4, 5] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[]
			}
		]
	};
	const TOMORROW = '2026-10-29';

	it('sits at the start of each work day, not on University days', () => {
		expect(reservedSlots(settings, TOMORROW)).toEqual([
			{ id: 'r1', label: 'Admin', category: 'Admin', start: 465, end: 485 }
		]);
		expect(reservedSlots(settings, '2026-11-03')).toEqual([]); // Tuesday: University
	});

	it('is filled by its category first and kept from everything else', () => {
		const admin = newTask(1, TODAY, { category: 'Admin', estimateMin: 20, title: 'Inbox zero' });
		const deep = newTask(2, TODAY, { estimateMin: 600, priority: 1, title: 'Deep' });
		const plan = buildPlan([admin, deep], [], settings, NOW);
		expect(plan.placed[admin.id]!.blocks[0]).toMatchObject({
			date: TOMORROW,
			start: 465,
			end: 485
		});
		for (const b of plan.blocks.filter((x) => x.taskId === deep.id))
			expect(b.date === TOMORROW && b.start < 485 && b.end > 465).toBe(false);
	});

	it('counts towards the day’s plannable time', () => {
		expect(dayCapacity(settings, [], TOMORROW)).toBe(Math.round(490 * 0.8) + 20);
	});
});

describe('dragged blocks', () => {
	const settings = exampleSettings();

	it('stay where they were dropped and push other work aside', () => {
		const a = newTask(1, TODAY, { estimateMin: 60, priority: 1, title: 'A' });
		const b = newTask(2, TODAY, {
			estimateMin: 60,
			priority: 5,
			title: 'B',
			fixed: { date: TODAY, start: 10 * 60 + 30 }
		});
		const plan = buildPlan([a, b], [], settings, NOW);
		expect(plan.placed[b.id]!.blocks).toEqual([
			{ taskId: b.id, date: TODAY, start: 630, end: 690 }
		]);
		for (const x of plan.placed[a.id]!.blocks) expect(x.start >= 690 || x.end <= 630).toBe(true);
	});

	it('are ignored once their day has passed', () => {
		const b = newTask(1, TODAY, { estimateMin: 30, fixed: { date: '2026-10-26', start: 600 } });
		const plan = buildPlan([b], [], settings, NOW);
		expect(plan.placed[b.id]!.blocks[0].date >= TODAY).toBe(true);
	});
});

describe('sub-task dependencies', () => {
	const settings = exampleSettings();
	const parent = newTask(1, TODAY, {
		title: 'Parent',
		subtasks: [
			{ id: 's1', title: 'Get quote', done: false },
			{ id: 's2', title: 'Order parts', done: false }
		]
	});
	const child = newTask(2, TODAY, { title: 'Child', deps: [`${parent.id}:s1`] });

	it('blocks until that sub-task is ticked', () => {
		expect(blockers(child, [parent, child]).map((b) => b.ref)).toEqual(['T-001 › Get quote']);
		expect(buildPlan([parent, child], [], settings, NOW).placed[child.id]).toBeNull();
	});

	it('frees the task once ticked, whatever the rest of the parent', () => {
		const ticked = {
			...parent,
			subtasks: parent.subtasks.map((x) => ({ ...x, done: x.id === 's1' }))
		};
		expect(blockers(child, [ticked, child])).toEqual([]);
		expect(buildPlan([ticked, child], [], settings, NOW).placed[child.id]).not.toBeNull();
	});
});

describe('daily focus', () => {
	it('adds up logged minutes per day, including empty days', () => {
		const t = newTask(1, TODAY, {
			log: [
				{ date: '2026-10-26', minutes: 30 },
				{ date: TODAY, minutes: 45 }
			]
		});
		expect(dailyFocus([t], '2026-10-26', TODAY).map((d) => d.minutes)).toEqual([30, 0, 45]);
	});
});

describe('quick wins', () => {
	const settings = exampleSettings();
	const TOMORROW = '2026-10-29';

	it('fill the first gap they fit, whole', () => {
		const q = newTask(1, TODAY, { quick: true, estimateMin: 10, title: 'Reply to Sam' });
		const plan = buildPlan([q], [], settings, NOW);
		expect(plan.placed[q.id]!.blocks).toEqual([
			{ taskId: q.id, date: TODAY, start: 615, end: 625 } // the current quarter-hour
		]);
	});

	it('go after the planned work, never in front of it', () => {
		const work = newTask(1, TODAY, { estimateMin: 60, priority: 1 });
		const q = newTask(2, TODAY, { quick: true, estimateMin: 10 });
		const plan = buildPlan([work, q], [], settings, NOW);
		expect(plan.placed[work.id]!.blocks[0].start).toBe(615);
		expect(plan.placed[q.id]!.blocks[0].start).toBe(675);
	});

	it('use reserved time its own category left empty', () => {
		const s = {
			...settings,
			reserved: [
				{
					id: 'r',
					label: 'Admin',
					category: 'Admin' as const,
					start: 'start' as const,
					minutes: 20,
					days: [4] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[]
				}
			]
		};
		// Fill today so the first room is tomorrow, where the Admin slot sits empty.
		const big = newTask(1, TODAY, { estimateMin: 2000, priority: 1 });
		const q = newTask(2, TODAY, { quick: true, estimateMin: 15, category: 'Comms' });
		const plan = buildPlan([big, q], [], { ...s, bufferPct: 0 }, NOW);
		expect(plan.placed[q.id]!.blocks[0]).toMatchObject({ date: TOMORROW, start: 465, end: 480 });
	});

	it('stay off the calendar when filling is turned off', () => {
		const q = newTask(1, TODAY, { quick: true, estimateMin: 10 });
		expect(buildPlan([q], [], { ...settings, fillQuickWins: false }, NOW).placed[q.id]).toBe(
			undefined
		);
	});
});

describe('confirmed blocks', () => {
	const settings = exampleSettings();

	it('stay exactly where they were confirmed, and the rest is still planned', () => {
		const t = newTask(1, TODAY, {
			estimateMin: 90,
			confirmed: [{ date: TODAY, start: 14 * 60, end: 15 * 60 }]
		});
		const other = newTask(2, TODAY, { estimateMin: 300, priority: 1 });
		const plan = buildPlan([t, other], [], settings, NOW);
		const mine = plan.placed[t.id]!.blocks;
		expect(mine).toContainEqual({ taskId: t.id, date: TODAY, start: 840, end: 900 });
		expect(mine.reduce((n, b) => n + b.end - b.start, 0)).toBe(90);
		for (const b of plan.placed[other.id]!.blocks)
			expect(b.date === TODAY && b.start < 900 && b.end > 840).toBe(false);
	});

	it('leave the plan as it was: confirming a day pulls no extra work into it', () => {
		const ts = [
			newTask(1, TODAY, { estimateMin: 200, priority: 1 }),
			newTask(2, TODAY, { estimateMin: 200, priority: 2 })
		];
		const plan = buildPlan(ts, [], settings, NOW);
		const today = (p: typeof plan) =>
			(p.byDate[TODAY] ?? []).map((b) => [b.taskId, b.start, b.end]);
		const locked = ts.map((t) => ({
			...t,
			confirmed: plan.placed[t.id]!.blocks.filter((b) => b.date === TODAY).map(
				({ date, start, end }) => ({ date, start, end })
			)
		}));
		expect(today(buildPlan(locked, [], settings, NOW))).toEqual(today(plan));
	});

	it('shrink when less work is left than was confirmed', () => {
		const t = newTask(1, TODAY, {
			estimateMin: 30,
			confirmed: [{ date: TODAY, start: 14 * 60, end: 15 * 60 }]
		});
		expect(buildPlan([t], [], settings, NOW).placed[t.id]!.blocks).toEqual([
			{ taskId: t.id, date: TODAY, start: 840, end: 870 }
		]);
	});
});

describe('planning methods', () => {
	const settings = exampleSettings();

	it('Eat the frog / Ivy Lee: tasks placed first get the earliest time, in order', () => {
		const a = newTask(1, TODAY, { estimateMin: 60, priority: 1, title: 'Big' });
		const frog = newTask(2, TODAY, { estimateMin: 60, priority: 5, title: 'Frog', frog: true });
		const plan = buildPlan([a, frog], [], settings, NOW, null, [frog.id]);
		expect(plan.placed[frog.id]!.blocks[0].start).toBe(615);
		expect(plan.placed[a.id]!.blocks[0].start).toBe(675);
	});

	it('the frog goes first even if its category prefers afternoons', () => {
		const frog = newTask(1, TODAY, { estimateMin: 30, category: 'Admin', frog: true });
		const plan = buildPlan([frog], [], settings, NOW, null, [frog.id]);
		expect(plan.placed[frog.id]!.blocks[0].start).toBe(615);
	});

	it('parked tasks (someday, waiting, delegated, dropped) are not planned', () => {
		const ts = [
			newTask(1, TODAY, { someday: true }),
			newTask(2, TODAY, { waiting: 'Sam' }),
			newTask(3, TODAY, { quadrant: 'delegate' }),
			newTask(4, TODAY, { quadrant: 'drop' }),
			newTask(5, TODAY, { quick: true, someday: true })
		];
		expect(buildPlan(ts, [], settings, NOW).blocks).toHaveLength(0);
	});

	it('Eisenhower: sorts by priority and due date, and the hand-set square wins', () => {
		expect(quadrantOf(newTask(1, TODAY, { priority: 1, due: TODAY }), TODAY)).toBe('do');
		expect(quadrantOf(newTask(2, TODAY, { priority: 2, due: '2026-11-20' }), TODAY)).toBe(
			'schedule'
		);
		expect(quadrantOf(newTask(3, TODAY, { priority: 4, due: '2026-10-29' }), TODAY)).toBe(
			'delegate'
		);
		expect(quadrantOf(newTask(4, TODAY, { priority: 5 }), TODAY)).toBe('drop');
		expect(quadrantOf(newTask(5, TODAY, { priority: 5, quadrant: 'do' }), TODAY)).toBe('do');
	});

	it('"Do first" outranks a higher-priority task in the plan', () => {
		const p1 = newTask(1, TODAY, { estimateMin: 60, priority: 2 });
		const doIt = newTask(2, TODAY, { estimateMin: 60, priority: 3, quadrant: 'do' });
		const plan = buildPlan([p1, doIt], [], settings, NOW);
		expect(plan.placed[doIt.id]!.blocks[0].start).toBeLessThan(plan.placed[p1.id]!.blocks[0].start);
	});

	it('1-3-5 sizes tasks by estimate and caps each group', () => {
		const ts = [
			newTask(1, TODAY, { estimateMin: 120 }),
			newTask(2, TODAY, { estimateMin: 180 }),
			...[1, 2, 3, 4].map((i) => newTask(10 + i, TODAY, { estimateMin: 45 })),
			...[1, 2, 3, 4, 5, 6].map((i) => newTask(20 + i, TODAY, { estimateMin: 10, quick: true }))
		];
		const plan = buildPlan(ts, [], settings, NOW);
		const g = oneThreeFive(ts, plan, TODAY);
		expect([g.big.length, g.medium.length, g.small.length]).toEqual([1, 3, 5]);
	});

	it('Ivy Lee keeps the order you set, then fills to six', () => {
		const ts = [1, 2, 3, 4, 5, 6, 7].map((i) => newTask(i, TODAY, { priority: 3 }));
		const plan = buildPlan(ts, [], settings, NOW);
		const list = ivyList(ts, plan, TODAY, { date: TODAY, ids: [ts[6].id, ts[5].id] });
		expect(list).toHaveLength(6);
		expect(list.slice(0, 2).map((t) => t.code)).toEqual([7, 6]);
	});

	it('the marked frog wins over the suggestion', () => {
		const ts = [
			newTask(1, TODAY, { priority: 1, estimateMin: 120 }),
			newTask(2, TODAY, { frog: true })
		];
		expect(frogOf(ts, buildPlan(ts, [], settings, NOW), TODAY)?.code).toBe(2);
	});
});

describe('your own categories and days', () => {
	it('captures with the person’s categories (start of a name, or any word in it)', () => {
		const cats = ['Writing', 'Client calls', 'Errands'];
		const base = { today: TODAY, projects: [], categories: cats };
		expect(parseCapture('Draft chapter #wri', base).cat).toBe('Writing');
		expect(parseCapture('Ring Jo #calls', base).cat).toBe('Client calls');
		expect(parseCapture('Post office #err', base).cat).toBe('Errands');
	});

	it('honours a category’s afternoon preference', () => {
		const s = {
			...exampleSettings(),
			categories: [{ name: 'Errands', color: 'amber' as const, when: 'afternoon' as const }]
		};
		const t = newTask(1, TODAY, { category: 'Errands', estimateMin: 30 });
		expect(buildPlan([t], [], s, NOW).placed[t.id]!.blocks[0].start).toBeGreaterThanOrEqual(
			12 * 60
		);
	});

	it('names away days by their label, and defaults to a plain Mon–Fri week', () => {
		expect(awayLabel({ kind: 'uni', label: 'Training' })).toBe('Training');
		expect(awayLabel({ kind: 'uni' })).toBe('Away');
		const d = defaultSettings();
		expect([1, 2, 3, 4, 5].every((n) => d.pattern[n as 1].kind === 'work')).toBe(true);
	});
});
