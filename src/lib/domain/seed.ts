import type {
	Category,
	Goal,
	ISODate,
	Meeting,
	Priority,
	Project,
	Settings,
	Status,
	Task,
	Workspace
} from '../types.ts';
import { addDays, dow, isWorkday, weekStart } from './dates.ts';

export function uid(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		Math.random().toString(36).slice(2) + Date.now().toString(36)
	);
}

export function defaultSettings(today: ISODate): Settings {
	const work = {
		kind: 'work' as const,
		start: '07:45',
		end: '16:45',
		lunch: ['12:00', '12:30'] as [string, string]
	};
	return {
		theme: 'system',
		pattern: {
			0: { kind: 'off' },
			1: work,
			2: { kind: 'uni', otjHours: 7.5 },
			3: work,
			4: work,
			5: { kind: 'work', start: '07:45', end: '12:30' },
			6: { kind: 'off' }
		},
		bufferPct: 20,
		wipLimit: 3,
		focusMin: 25,
		breakMin: 5,
		leave: [],
		otjTarget: 400,
		otjStart: addDays(today, -364)
	};
}

export function blankWorkspace(today: ISODate): Workspace {
	return {
		tasks: [],
		projects: [],
		meetings: [],
		goals: [],
		settings: defaultSettings(today),
		nextCode: 1,
		nextProjectCode: 1,
		onboarded: true
	};
}

export function newTask(code: number, today: ISODate, patch: Partial<Task> = {}): Task {
	return {
		id: uid(),
		code,
		title: '',
		notes: '',
		status: 'next',
		inbox: false,
		quick: false,
		projectId: null,
		category: 'Deep Work',
		priority: 3,
		estimateMin: 30,
		loggedMin: 0,
		due: null,
		start: 'auto',
		startDate: null,
		repeat: '',
		deps: [],
		subtasks: [],
		log: [],
		createdAt: today,
		doneAt: null,
		...patch
	};
}

/** The example plan from the design boards, laid out around today. */
export function exampleWorkspace(today: ISODate): Workspace {
	const settings = defaultSettings(today);
	const ws = weekStart(today);
	const d = (n: number) => addDays(today, n);

	const projects: Project[] = [
		{
			id: 'p1',
			code: 1,
			name: 'Test Fixture Rev B',
			description: 'Bench test fixture for the PSU line',
			due: d(21)
		},
		{
			id: 'p2',
			code: 2,
			name: 'HNC Unit 5 Lab Report',
			description: 'Filter design lab and write-up',
			due: d(5)
		},
		{
			id: 'p3',
			code: 3,
			name: 'HNC Unit 7',
			description: 'Maths for engineering — exam prep',
			due: d(22)
		},
		{
			id: 'p4',
			code: 4,
			name: 'Line 3 Maintenance',
			description: 'Calibration and obsolescence',
			due: null
		}
	];

	let code = 11;
	const tasks: Task[] = [];
	const add = (
		title: string,
		o: {
			p?: string | null;
			cat?: Category;
			pri?: Priority;
			est?: number;
			logged?: number;
			due?: ISODate | null;
			status?: Status;
			inbox?: boolean;
			quick?: boolean;
			deps?: string[];
			doneAt?: ISODate | null;
			start?: Task['start'];
			repeat?: Task['repeat'];
			notes?: string;
			subtasks?: string[];
		} = {}
	) => {
		const id = `t${code}`;
		const logged = o.logged ?? (o.status === 'done' ? (o.est ?? 30) : 0);
		const log = logged ? [{ date: o.doneAt ?? d(-1), minutes: logged }] : [];
		tasks.push(
			newTask(code++, d(-6), {
				id,
				title,
				projectId: o.p ?? null,
				category: o.cat ?? 'Deep Work',
				priority: o.pri ?? 3,
				estimateMin: o.est ?? 30,
				loggedMin: logged,
				due: o.due ?? null,
				status: o.status ?? 'next',
				inbox: o.inbox ?? false,
				quick: o.quick ?? false,
				deps: o.deps ?? [],
				doneAt: o.status === 'done' ? (o.doneAt ?? d(-1)) : null,
				start: o.start ?? 'auto',
				repeat: o.repeat ?? '',
				notes: o.notes ?? '',
				log,
				subtasks: (o.subtasks ?? []).map((s, i) => ({ id: `${id}s${i}`, title: s, done: i === 0 }))
			})
		);
		return id;
	};

	const schem = add('Schematic sign-off', {
		p: 'p1',
		pri: 1,
		est: 60,
		status: 'done',
		doneAt: d(-3),
		cat: 'Review'
	});
	add('Simulate filter stage in LTspice', {
		p: 'p2',
		pri: 2,
		est: 90,
		logged: 45,
		due: d(-1),
		status: 'doing',
		cat: 'Deep Work'
	});
	add('Review PCB layout for test fixture', {
		p: 'p1',
		pri: 1,
		est: 120,
		logged: 35,
		due: d(1),
		status: 'doing',
		cat: 'Deep Work',
		deps: [schem],
		notes: 'Focus on the high-current traces near the relay bank.',
		subtasks: [
			'Check clearances against IPC-2221',
			'Review relay bank traces',
			'Mark up the Gerbers'
		]
	});
	add('Draft HNC Unit 5 lab report', {
		p: 'p2',
		pri: 2,
		est: 180,
		due: d(4),
		cat: 'Study',
		status: 'next'
	});
	add('Prepare weekly progress summary', {
		pri: 2,
		est: 30,
		due: d(0),
		cat: 'Admin',
		status: 'next',
		repeat: 'weekly'
	});
	add('Expense claim for training travel', {
		pri: 3,
		est: 20,
		due: d(-2),
		cat: 'Admin',
		status: 'next'
	});
	const order = add('Order connectors for fixture harness', {
		p: 'p1',
		pri: 2,
		est: 20,
		status: 'done',
		doneAt: d(-2),
		cat: 'Admin'
	});
	const harness = add('Build fixture harness', {
		p: 'p1',
		pri: 2,
		est: 240,
		due: d(11),
		cat: 'Deep Work',
		status: 'backlog',
		deps: [order]
	});
	const plan = add('Write validation test plan', {
		p: 'p1',
		pri: 2,
		est: 150,
		due: d(9),
		cat: 'Deep Work',
		status: 'next'
	});
	add('Run fixture validation', {
		p: 'p1',
		pri: 1,
		est: 180,
		due: d(13),
		cat: 'Deep Work',
		status: 'backlog',
		deps: [harness, plan]
	});
	add('Write burn-in rig test procedure', {
		p: 'p1',
		pri: 3,
		est: 105,
		due: d(8),
		cat: 'Deep Work',
		status: 'backlog'
	});
	add('Revise maths for Unit 7 exam', {
		p: 'p3',
		pri: 3,
		est: 300,
		due: d(20),
		cat: 'Study',
		status: 'backlog'
	});
	add('Read IPC-2221 clearance section', { pri: 4, est: 60, cat: 'Study', status: 'backlog' });
	add('Update component obsolescence list', {
		p: 'p4',
		pri: 4,
		est: 45,
		cat: 'Admin',
		status: 'backlog',
		due: d(16)
	});
	add('Calibrate scope probes', {
		p: 'p4',
		pri: 3,
		est: 45,
		due: d(2),
		cat: 'Review',
		status: 'review'
	});
	add('Prepare design review slides', {
		p: 'p1',
		pri: 2,
		est: 45,
		due: d(0),
		cat: 'Comms',
		status: 'next'
	});
	add('Portfolio write-up', { pri: 4, est: 90, cat: 'Study', status: 'backlog', start: 'manual' });
	add('Reply to supplier about lead times', {
		pri: 3,
		est: 10,
		quick: true,
		cat: 'Comms',
		status: 'next'
	});
	add('File expenses', { pri: 4, est: 10, quick: true, cat: 'Admin', status: 'next' });
	add('Book calibration slot', {
		pri: 3,
		est: 15,
		quick: true,
		cat: 'Admin',
		status: 'next',
		p: 'p4'
	});
	add('Update Teams status', { pri: 5, est: 5, quick: true, cat: 'Comms', status: 'next' });
	add('Ask Sam about torque spec for M4 inserts', {
		inbox: true,
		cat: 'Comms',
		est: 0,
		status: 'backlog'
	});
	add('Look into a cheaper PCB fab house', {
		inbox: true,
		cat: 'Admin',
		est: 0,
		status: 'backlog'
	});

	// Some logged history for Insights.
	const hist: [number, string, number][] = [
		[-1, 't12', 30],
		[-2, 't14', 60],
		[-3, 't14', 50],
		[-4, 't24', 20],
		[-5, 't22', 90],
		[-6, 't14', 30],
		[-8, 't19', 45],
		[-9, 't23', 40]
	];
	for (const [n, id, m] of hist) {
		const t = tasks.find((x) => x.id === id);
		if (t) {
			t.log.push({ date: d(n), minutes: m });
			t.loggedMin += m;
		}
	}

	const meetings: Meeting[] = [];
	for (let i = 0; i < 28; i++) {
		const day = addDays(ws, i);
		if (isWorkday(settings, day))
			meetings.push({ id: uid(), title: 'Team stand-up', date: day, start: '09:00', end: '09:15' });
		if (dow(day) === 1)
			meetings.push({
				id: uid(),
				title: '1:1 with mentor',
				date: day,
				start: '14:30',
				end: '15:00'
			});
	}
	meetings.push({
		id: uid(),
		title: 'Design review',
		date: isWorkday(settings, today) ? today : d(1),
		start: '13:00',
		end: '14:00'
	});

	const goals: Goal[] = [
		{
			id: 'g1',
			title: 'Bank 30 hours of deep work',
			why: 'Protect the hard thinking this month',
			source: 'logged',
			category: 'Deep Work',
			current: 0,
			target: 30,
			unit: 'h',
			start: d(-14),
			due: d(16)
		},
		{
			id: 'g2',
			title: 'Ship Test Fixture Rev B',
			source: 'project',
			projectId: 'p1',
			current: 0,
			target: 100,
			unit: '%',
			start: d(-20),
			due: d(21)
		},
		{
			id: 'g3',
			title: 'Read four standards cover to cover',
			source: 'manual',
			current: 1,
			target: 4,
			unit: 'docs',
			start: d(-30),
			due: d(60)
		}
	];

	return {
		tasks,
		projects,
		meetings,
		goals,
		settings,
		nextCode: code,
		nextProjectCode: 5,
		onboarded: true
	};
}
