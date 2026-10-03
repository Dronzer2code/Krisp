import type { Beat, Id, Workspace } from '../model/types';

// Hold-to-audition (docs/PROCESS_FLOW.md J9): while held, a candidate plays in place of the selected Beat.
// Playback-only override: never written to the store or undo history.

let override: { beatId: Id; steps: Beat['steps']; length: 16 | 32 } | null = null;

export function setAudition(o: typeof override) {
  override = o;
}

export function withAudition(w: Workspace): Workspace {
  if (!override) return w;
  const o = override;
  return { ...w, beats: w.beats.map((b) => (b.id === o.beatId ? { ...b, steps: o.steps, length: o.length } : b)) };
}
