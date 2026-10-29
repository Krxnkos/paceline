import type { Goal, Meeting, Project, Task } from '../types.ts';

/** Which overlay is open. One place so keyboard shortcuts and the palette can drive them. */
class UI {
	sidebarOpen = $state(false); // phone drawer
	sidebarHidden = $state(false); // desktop, '[' key
	palette = $state(false);
	shortcuts = $state(false);
	newTask = $state<{ open: boolean; defaults?: Partial<Task>; text?: string }>({ open: false });
	meeting = $state<{ open: boolean; meeting?: Meeting; date?: string }>({ open: false });
	project = $state<{ open: boolean; project?: Project }>({ open: false });
	goal = $state<{ open: boolean; goal?: Goal }>({ open: false });
	focusOpen = $state(false);

	openNewTask(defaults?: Partial<Task>, text = '') {
		this.newTask = { open: true, defaults, text };
	}
	openMeeting(meeting?: Meeting, date?: string) {
		this.meeting = { open: true, meeting, date };
	}
	openProject(project?: Project) {
		this.project = { open: true, project };
	}
	openGoal(goal?: Goal) {
		this.goal = { open: true, goal };
	}

	anyOverlay = $derived(
		this.palette ||
			this.shortcuts ||
			this.newTask.open ||
			this.meeting.open ||
			this.project.open ||
			this.goal.open ||
			this.focusOpen
	);
}

export const ui = new UI();
