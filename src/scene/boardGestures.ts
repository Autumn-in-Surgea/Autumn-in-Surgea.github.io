interface Contact {
  x: number;
  y: number;
}

interface GestureState {
  contacts: Map<number, Contact>;
  dragged: boolean;
  tap: PointerEvent | null;
}

const gestures = new WeakMap<HTMLCanvasElement, GestureState>();

/** Classify a tap before the controller sees movement and before R3F picks on release. */
export function bindBoardGestures(canvas: HTMLCanvasElement, onDrag: () => void) {
  const state: GestureState = { contacts: new Map(), dragged: false, tap: null };
  gestures.set(canvas, state);

  function down(event: PointerEvent) {
    const { contacts } = state;
    if (contacts.size >= 2) {
      event.stopImmediatePropagation();
      return;
    }
    if (!contacts.size) {
      state.dragged = false;
      state.tap = null;
    }
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (contacts.size === 2 && !state.dragged) {
      state.dragged = true;
      onDrag();
    }
  }

  function move(event: PointerEvent) {
    const { contacts } = state;
    if (contacts.size === 0) return;
    const initial = contacts.get(event.pointerId);
    // Extra fingers never enter the two-contact camera gesture.
    if (!initial) {
      event.stopImmediatePropagation();
      return;
    }
    if (state.dragged) return;
    if (withinTapRadius(event, initial)) {
      // Keep tiny movement under a tapping finger from translating the board.
      event.stopImmediatePropagation();
      return;
    }
    state.dragged = true;
    onDrag();
  }

  function release(event: PointerEvent) {
    const initial = state.contacts.get(event.pointerId);
    if (!initial) {
      if (state.contacts.size) event.stopImmediatePropagation();
      return;
    }
    state.contacts.delete(event.pointerId);
    if (event.type !== "pointerup" || event.button !== 0 || state.contacts.size ||
      state.dragged || !withinTapRadius(event, initial)) return;

    const rect = canvas.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX < rect.right &&
      event.clientY >= rect.top && event.clientY < rect.bottom) state.tap = event;
  }

  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", release, true);
  canvas.addEventListener("pointercancel", release, true);
  return () => {
    canvas.removeEventListener("pointerdown", down, true);
    canvas.removeEventListener("pointermove", move, true);
    canvas.removeEventListener("pointerup", release, true);
    canvas.removeEventListener("pointercancel", release, true);
    gestures.delete(canvas);
  };
}

function withinTapRadius(event: PointerEvent, initial: Contact) {
  const dx = event.clientX - initial.x;
  const dy = event.clientY - initial.y;
  const radius = event.pointerType === "touch" ? 5 : 3;
  return dx * dx + dy * dy < radius * radius;
}

export function canHoverBoard(canvas: HTMLCanvasElement, event: PointerEvent) {
  return event.pointerType !== "touch" && !event.buttons && !gestures.get(canvas)?.contacts.size;
}

export function takeBoardTap(canvas: HTMLCanvasElement, event: PointerEvent) {
  const state = gestures.get(canvas);
  if (state?.tap !== event) return false;
  state.tap = null;
  return true;
}
