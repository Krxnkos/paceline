export type ISODate = string; // 'YYYY-MM-DD'
export type HM = string; // 'HH:MM'

export type Status = 'backlog' | 'next' | 'doing' | 'review' | 'done';
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
	| { kind: 'uni'; otjHours: number }
	| { kind: 'off' };

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type ThemeId = 'carbon' | 'chalk' | 'midnight' | 'frost' | 'ember' | 'sand';
export type ThemeChoice = ThemeId | 'system';

export interface Settings {
	theme: ThemeChoice;
	pattern: Record<Weekday, DayPattern>;
	bufferPct: number;
	wipLimit: number;
	focusMin: number;
	breakMin: number;
	leave: ISODate[];
	otjTarget: number;
	otjStart: ISODate;
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
