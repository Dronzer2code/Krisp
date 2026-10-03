import type { Workspace } from '../model/types';

// Undo history of whole Workspace snapshots (structural sharing via immutable updates).
// docs/TRD.md → DATA MODEL rules: 100 entries; consecutive knob/fader drags coalesce into one entry.

export const HISTORY_LIMIT = 100;

export interface History {
  past: Workspace[];
  future: Workspace[];
  /** Workspace before the current drag gesture started; null when no gesture is open. */
  gestureBase: Workspace | null;
}

export function emptyHistory(): History {
  return { past: [], future: [], gestureBase: null };
}

export function pushPast(past: Workspace[], snapshot: Workspace): Workspace[] {
  const next = past.length >= HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT + 1) : past.slice();
  next.push(snapshot);
  return next;
}

/** Records a normal edit: `prev` becomes undoable, redo stack clears. Closes any open gesture first. */
export function recordEdit(h: History, prev: Workspace): History {
  const base = h.gestureBase ?? prev;
  return { past: pushPast(h.past, base), future: [], gestureBase: null };
}

/** Records one step of a drag; only the state before the first step is kept. */
export function recordGestureStep(h: History, prev: Workspace): History {
  return h.gestureBase ? h : { ...h, gestureBase: prev };
}

/** Ends a drag; one undo entry if anything changed. */
export function endGesture(h: History, current: Workspace): History {
  if (!h.gestureBase) return h;
  if (h.gestureBase === current) return { ...h, gestureBase: null };
  return { past: pushPast(h.past, h.gestureBase), future: [], gestureBase: null };
}

export function undo(h: History, current: Workspace): { history: History; workspace: Workspace } | null {
  const closed = endGesture(h, current);
  if (closed.past.length === 0) return null;
  const prev = closed.past[closed.past.length - 1];
  return {
    workspace: prev,
    history: { past: closed.past.slice(0, -1), future: [current, ...closed.future], gestureBase: null },
  };
}

export function redo(h: History, current: Workspace): { history: History; workspace: Workspace } | null {
  if (h.future.length === 0) return null;
  const [next, ...rest] = h.future;
  return { workspace: next, history: { past: pushPast(h.past, current), future: rest, gestureBase: null } };
}
