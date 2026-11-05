export type ISODate = string; // 'YYYY-MM-DD'
export type HM = string; // 'HH:MM'

/** A board column id. The built-ins are backlog, next, doing, review and done. */
export type Status = string;
export type TaskScope = 'work' | 'personal';

export interface Column {
	id: Status;
	label: string;
}

export const LABEL_COLORS = ['ink', 'accent', 'ice', 'lilac', 'amber', 'flare'] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export interface Label {
	id: string;
	name: string;
	color: LabelColor;
}
export type Category = 'Deep Work' | 'Study' | 'Admin' | 'Comms' | 'Review';
export type StartMode = 'auto' | 'asap' | 'date' | 'manual';
export type Repeat = '' | 'daily' | 'weekly' | 'fortnightly' | 'monthly';
export type Tone = 'late' | 'warn' | 'info' | 'lead' | 'plain' | 'mute';
export type Priority = 1 | 2 | 3 | 4 | 5;

export interface Subtask {
	id: string;
	title: string;
	done: boolean;
}

export interface LogEntry {
	date: ISODate;
	minutes: number;
}

export interface Task {
	id: string;
	code: number; // T-014
	title: string;
	notes?: string;
	status: Status;
	inbox: boolean;
	quick: boolean;
	projectId: string | null;
	category: Category;
	priority: Priority; // 1 = critical
	estimateMin: number;
	loggedMin: number;
	due: ISODate | null;
	start: StartMode;
	startDate: ISODate | null;
	repeat: Repeat;
	deps: string[];
	subtasks: Subtask[];
	log: LogEntry[];
	createdAt: ISODate;
	doneAt: ISODate | null;
	/** Blocks that really happened; they stay on the calendar after completion. */
	history?: BlockSpan[];
	/** Minutes of scheduled blocks already used, for tasks split across blocks. */
	creditMin?: number;
	/** Personal tasks only run on Personal and non-working days; work tasks never do. */
	scope?: TaskScope;
	labels?: string[];
	/** Dragged to a fixed start on the calendar; the planner keeps it there. */
	fixed?: { date: ISODate; start: number } | null;
	/** Planned blocks the person confirmed: kept exactly where they are. */
	confirmed?: { date: ISODate; start: number; end: number }[] | null;
}

/** Time set aside every week for one category, e.g. 20 minutes of Admin at the start of each day. */
export interface Reserved {
	id: string;
	label: string;
	category: Category;
	/** 'start' means the start of the working day. */
	start: HM | 'start';
	minutes: number;
	days: Weekday[];
}

export interface BlockSpan {
	date: ISODate;
	start: number;
	end: number;
}

/** The lit block, fixed once it starts so its end time can't drift. */
export interface ActiveBlock extends BlockSpan {
	taskId: string;
}

export interface Project {
	id: string;
	code: number;
	name: string;
	description: string;
	due: ISODate | null;
}

export interface Meeting {
	id: string;
	title: string;
	date: ISODate;
	start: HM;
	end: HM;
}

export interface Goal {
	id: string;
	title: string;
	why?: string;
	source: 'manual' | 'project' | 'logged';
	projectId?: string;
	category?: Category;
	current: number;
	target: number;
	unit: string;
	start: ISODate;
	due: ISODate;
}

export type DayPattern =
	| { kind: 'work'; start: HM; end: HM; lunch?: [HM, HM] }
	| { kind: 'uni' }
	| { kind: 'personal'; start: HM; end: HM }
	| { kind: 'off' };

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type ThemeId =
	| 'carbon'
	| 'chalk'
	| 'midnight'
	| 'frost'
	| 'ember'
	| 'sand'
	| 'harbor'
	| 'orchid'
	| 'gilt'
	| 'terminal';
export type ThemeChoice = ThemeId | 'system';

export interface Settings {
	theme: ThemeChoice;
	pattern: Record<Weekday, DayPattern>;
	bufferPct: number;
	wipLimit: number;
	focusMin: number;
	breakMin: number;
	/** 'fit' sizes the focus timer to the rest of the current block. */
	focusMode?: 'fixed' | 'fit';
	leave: ISODate[];
	reserved?: Reserved[];
	/** Put quick wins into leftover gaps and unused reserved time (on unless turned off). */
	fillQuickWins?: boolean;
}

export interface Block {
	taskId: string;
	date: ISODate;
	start: number; // minutes from midnight
	end: number;
}

export interface Placement {
	startDate: ISODate;
	endDate: ISODate;
	endMin: number;
	blocks: Block[];
}

export interface Plan {
	blocks: Block[];
	byDate: Record<ISODate, Block[]>;
	placed: Record<string, Placement | null>;
	beyond: string[]; // no room in 120 days
}

export interface Workspace {
	tasks: Task[];
	projects: Project[];
	meetings: Meeting[];
	goals: Goal[];
	settings: Settings;
	nextCode: number;
	nextProjectCode: number;
	onboarded: boolean;
	/** Custom board columns and labels (Pro and Ultimate). */
	columns?: Column[];
	labels?: Label[];
	active?: ActiveBlock | null;
	/** A block that ended with its task unfinished, waiting on "Did you complete this?". */
	awaiting?: ActiveBlock | null;
}

export interface Badge {
	key: string;
	label: string;
	tone: Tone;
}

export interface Alert {
	tone: Tone;
	label: string;
	text: string;
	sub?: string;
	taskId?: string;
	view?: string;
}

export const STATUSES: { id: Status; label: string }[] = [
	{ id: 'backlog', label: 'Backlog' },
	{ id: 'next', label: 'Next up' },
	{ id: 'doing', label: 'In progress' },
	{ id: 'review', label: 'Review' },
	{ id: 'done', label: 'Done' }
];

export const CATEGORIES: Category[] = ['Deep Work', 'Study', 'Admin', 'Comms', 'Review'];

export const REPEATS: { id: Repeat; label: string }[] = [
	{ id: '', label: 'Does not repeat' },
	{ id: 'daily', label: 'Daily' },
	{ id: 'weekly', label: 'Weekly' },
	{ id: 'fortnightly', label: 'Fortnightly' },
	{ id: 'monthly', label: 'Monthly' }
];

export const START_MODES: { id: StartMode; label: string }[] = [
	{ id: 'auto', label: 'Auto · planner decides' },
	{ id: 'asap', label: 'ASAP · first in line' },
	{ id: 'date', label: 'Not before a date' },
	{ id: 'manual', label: 'Manual · never scheduled' }
];
