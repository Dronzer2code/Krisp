import { useSyncExternalStore } from 'react';

// Lightweight external store for playback position. The grid and transport subscribe here so a tick
// never re-renders the whole Workspace tree (docs/TRD.md → SCHEDULING, PERFORMANCE).

export interface PlayheadState {
  playing: boolean;
  /** Global 16th-note tick since start (after loop wrap). -1 when stopped. */
  tick: number;
  /** Step index inside the selected Beat (BEAT mode) or -1. */
  beatStep: number;
  /** Seconds since start (for mm:ss). */
  seconds: number;
}

let state: PlayheadState = { playing: false, tick: -1, beatStep: -1, seconds: 0 };
const listeners = new Set<() => void>();

export function getPlayhead(): PlayheadState {
  return state;
}

export function setPlayhead(patch: Partial<PlayheadState>) {
  state = { ...state, ...patch };
  listeners.forEach((cb) => cb());
}

export function subscribePlayhead(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePlayhead<T>(select: (s: PlayheadState) => T): T {
  return useSyncExternalStore(subscribePlayhead, () => select(state));
}

// Per-Slot hit flashes (pad + rack LED). Listeners get the slot id.
const hitListeners = new Set<(slotId: string) => void>();
export function emitHit(slotId: string) {
  hitListeners.forEach((cb) => cb(slotId));
}
export function subscribeHits(cb: (slotId: string) => void): () => void {
  hitListeners.add(cb);
  return () => hitListeners.delete(cb);
}
