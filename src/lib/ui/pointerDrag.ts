/**
 * Pointer-based dragging that works the same with a mouse, pen or finger.
 *
 * - Mouse and pen: the drag starts once the pointer has moved a few pixels, so a
 *   plain click still clicks.
 * - Touch: press and hold briefly to lift the item; a quick swipe scrolls as usual.
 * - Escape cancels. The click that ends a drag is swallowed so it doesn't open things.
 * - While dragging near the edge of a scroll area, it scrolls.
 */
export interface DragCallbacks {
	/**
	 * Return false to refuse the drag. `origin` is where the pointer went down and
	 * `node` the element being dragged, so the grab point is exact.
	 */
	start(e: PointerEvent, origin: { x: number; y: number }, node: HTMLElement): boolean | void;
	move(e: PointerEvent): void;
	end(e: PointerEvent | null, cancelled: boolean): void;
}

export interface PointerDragOptions {
	enabled: boolean;
	callbacks: DragCallbacks;
	/** Containers to auto-scroll while dragging (the page always scrolls). */
	scroll?: () => (HTMLElement | null | undefined)[];
}

const MOUSE_THRESHOLD = 5;
const TOUCH_HOLD_MS = 260;
const TOUCH_SLOP = 8;
const EDGE = 48;

export function pointerDrag(node: HTMLElement, initial: PointerDragOptions) {
	let opts = initial;
	let pending: {
		id: number;
		x: number;
		y: number;
		touch: boolean;
		timer?: ReturnType<typeof setTimeout>;
	} | null = null;
	let active = false;
	let last: PointerEvent | null = null;
	let frame = 0;

	const blockTouchScroll = (e: TouchEvent) => {
		if (active) e.preventDefault();
	};

	function swallowClick(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
	}

	function autoScroll() {
		if (!active || !last) return;
		const { clientX: x, clientY: y } = last;
		const step = (d: number) => Math.sign(d) * Math.min(18, Math.abs(d) / 2.5);
		const dy = y < EDGE ? y - EDGE : y > innerHeight - EDGE ? y - (innerHeight - EDGE) : 0;
		if (dy) {
			const page = document.querySelector<HTMLElement>('[data-scroll-root]');
			(page ?? document.scrollingElement)?.scrollBy(0, step(dy));
		}
		for (const el of opts.scroll?.() ?? []) {
			if (!el) continue;
			const r = el.getBoundingClientRect();
			const dx =
				x < r.left + EDGE ? x - (r.left + EDGE) : x > r.right - EDGE ? x - (r.right - EDGE) : 0;
			if (dx) el.scrollBy(step(dx), 0);
		}
		if (dy || opts.scroll) opts.callbacks.move(last);
		frame = requestAnimationFrame(autoScroll);
	}

	function begin(e: PointerEvent) {
		const origin = { x: pending?.x ?? e.clientX, y: pending?.y ?? e.clientY };
		if (opts.callbacks.start(e, origin, node) === false) {
			reset();
			return;
		}
		active = true;
		last = e;
		document.documentElement.classList.add('pl-dragging');
		try {
			node.setPointerCapture(e.pointerId);
		} catch {
			/* pointer already gone */
		}
		if (pending?.touch) navigator.vibrate?.(8);
		frame = requestAnimationFrame(autoScroll);
	}

	function onDown(e: PointerEvent) {
		if (!opts.enabled || pending || active) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const touch = e.pointerType === 'touch';
		pending = { id: e.pointerId, x: e.clientX, y: e.clientY, touch };
		if (touch) pending.timer = setTimeout(() => pending && begin(e), TOUCH_HOLD_MS);
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
		window.addEventListener('keydown', onKey);
		window.addEventListener('touchmove', blockTouchScroll, { passive: false });
	}

	function onMove(e: PointerEvent) {
		if (!pending || e.pointerId !== pending.id) return;
		const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
		if (!active) {
			if (pending.touch) {
				// Moved before the hold finished: the person is scrolling.
				if (dist > TOUCH_SLOP) reset();
				return;
			}
			if (dist < MOUSE_THRESHOLD) return;
			begin(e);
			if (!active) return;
		}
		last = e;
		opts.callbacks.move(e);
	}

	function finish(e: PointerEvent | null, cancelled: boolean) {
		const was = active;
		reset();
		if (!was) return;
		opts.callbacks.end(e, cancelled);
		// The click that follows a drag shouldn't open the task.
		window.addEventListener('click', swallowClick, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0);
	}

	function onUp(e: PointerEvent) {
		if (pending && e.pointerId === pending.id) finish(e, false);
	}

	function onCancel(e: PointerEvent) {
		if (pending && e.pointerId === pending.id) finish(null, true);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && active) {
			e.preventDefault();
			finish(null, true);
		}
	}

	function reset() {
		if (pending?.timer) clearTimeout(pending.timer);
		if (pending && active) {
			try {
				node.releasePointerCapture(pending.id);
			} catch {
				/* already released */
			}
		}
		pending = null;
		active = false;
		last = null;
		cancelAnimationFrame(frame);
		document.documentElement.classList.remove('pl-dragging');
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onCancel);
		window.removeEventListener('keydown', onKey);
		window.removeEventListener('touchmove', blockTouchScroll);
	}

	node.addEventListener('pointerdown', onDown);
	// Long-press on touch would otherwise open the browser's context menu.
	const noMenu = (e: Event) => opts.enabled && e.preventDefault();
	node.addEventListener('contextmenu', noMenu);
	// Stop the browser's own drag-and-drop for links and images inside.
	const noNative = (e: Event) => e.preventDefault();
	node.addEventListener('dragstart', noNative);

	return {
		update(next: PointerDragOptions) {
			opts = next;
		},
		destroy() {
			if (active) finish(null, true);
			else reset();
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('contextmenu', noMenu);
			node.removeEventListener('dragstart', noNative);
		}
	};
}
