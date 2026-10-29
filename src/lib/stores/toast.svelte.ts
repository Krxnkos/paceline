export interface ToastOpts {
	action?: 'Undo' | 'Open';
	onAction?: () => void;
	tone?: 'ok' | 'err';
}

export interface ToastItem extends ToastOpts {
	id: number;
	msg: string;
}

class Toasts {
	items = $state<ToastItem[]>([]);
	#id = 0;

	show(msg: string, opts: ToastOpts = {}) {
		const id = ++this.#id;
		this.items = [...this.items, { id, msg, ...opts }].slice(-3);
		setTimeout(() => this.dismiss(id), opts.action ? 6500 : 3600);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new Toasts();
export const toast = (msg: string, opts?: ToastOpts) => toasts.show(msg, opts);
