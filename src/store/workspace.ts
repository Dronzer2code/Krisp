import { create } from 'zustand';
import { newWorkspace } from '../model/defaults';
import type { Workspace } from '../model/types';
import * as H from './history';
import * as ops from './ops';

// One store for the open Workspace + undo history (docs/TRD.md → STACK, DATA MODEL rules).
//
// Edit modes:
//   'push'    — normal edit, one undo entry.
//   'gesture' — one step of a drag (knob, fader, pad paint, clip move). Call endGesture() on pointer-up;
//               the whole drag becomes one undo entry.
//   'silent'  — no undo entry (selection, play mode). Still counts as a change for autosave.

export type EditMode = 'push' | 'gesture' | 'silent';

export interface WorkspaceState {
  workspace: Workspace;
  history: H.History;
  /** Increments on every change to `workspace` (autosave watches this). */
  revision: number;
  edit: (fn: (w: Workspace) => Workspace, mode?: EditMode) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the Workspace and clears history (open / new). */
  load: (w: Workspace) => void;
  /** Sets fields that come back from the server (id) without history or a new revision. */
  patchMeta: (patch: Partial<Pick<Workspace, 'id'>>) => void;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  workspace: newWorkspace(),
  history: H.emptyHistory(),
  revision: 0,

  edit(fn, mode = 'push') {
    const { workspace, history, revision } = get();
    const next = fn(workspace);
    if (next === workspace) return;
    const nextHistory =
      mode === 'push' ? H.recordEdit(history, workspace) : mode === 'gesture' ? H.recordGestureStep(history, workspace) : history;
    set({ workspace: next, history: nextHistory, revision: revision + 1 });
  },

  endGesture() {
    const { workspace, history } = get();
    const next = H.endGesture(history, workspace);
    if (next !== history) set({ history: next });
  },

  undo() {
    const { workspace, history, revision } = get();
    const r = H.undo(history, workspace);
    if (r) set({ workspace: r.workspace, history: r.history, revision: revision + 1 });
  },

  redo() {
    const { workspace, history, revision } = get();
    const r = H.redo(history, workspace);
    if (r) set({ workspace: r.workspace, history: r.history, revision: revision + 1 });
  },

  load(w) {
    set({ workspace: w, history: H.emptyHistory(), revision: 0 });
  },

  patchMeta(patch) {
    const { workspace } = get();
    set({ workspace: { ...workspace, ...patch } });
  },
}));

export const canUndo = (s: WorkspaceState) => s.history.past.length > 0 || s.history.gestureBase !== null;
export const canRedo = (s: WorkspaceState) => s.history.future.length > 0;

// Bound actions. Drag-capable actions take an optional mode (default 'push').
type Rest<F> = F extends (w: Workspace, ...args: infer A) => Workspace ? A : never;
function bind<F extends (w: Workspace, ...args: never[]) => Workspace>(op: F, mode: EditMode = 'push') {
  return (...args: Rest<F>) => useWorkspace.getState().edit((w) => (op as (w: Workspace, ...a: Rest<F>) => Workspace)(w, ...args), mode);
}
function bindMode<F extends (w: Workspace, ...args: never[]) => Workspace>(op: F) {
  return (mode: EditMode, ...args: Rest<F>) =>
    useWorkspace.getState().edit((w) => (op as (w: Workspace, ...a: Rest<F>) => Workspace)(w, ...args), mode);
}

export const actions = {
  setName: bind(ops.setName),
  setBpm: bindMode(ops.setBpm),
  setSwing: bindMode(ops.setSwing),
  setPlayMode: bind(ops.setPlayMode, 'silent'),
  setMetronome: bind(ops.setMetronome),
  setLoop: bind(ops.setLoop),
  setSongBars: bind(ops.setSongBars),

  addSlot: bind(ops.addSlot),
  removeSlot: bind(ops.removeSlot),
  updateSlot: bindMode(ops.updateSlot),

  selectBeat: bind(ops.selectBeat, 'silent'),
  addBeat: bind(ops.addBeat),
  duplicateBeat: bind(ops.duplicateBeat),
  renameBeat: bind(ops.renameBeat),
  recolorBeat: bind(ops.recolorBeat),
  deleteBeat: bind(ops.deleteBeat),
  insertPresetBeat: bind(ops.insertPresetBeat),
  setBeatLength: bind(ops.setBeatLength),
  setStep: bindMode(ops.setStep),
  toggleStep: bind(ops.toggleStep),
  cycleVelocity: bind(ops.cycleVelocity),
  clearRow: bind(ops.clearRow),
  clearBeat: bind(ops.clearBeat),
  setBeatSteps: bind(ops.setBeatSteps),
  addBeatFromSteps: bind(ops.addBeatFromSteps),

  addLane: bind(ops.addLane),
  renameLane: bind(ops.renameLane),
  removeLane: bind(ops.removeLane),
  addClip: bind(ops.addClip),
  updateClip: bindMode(ops.updateClip),
  removeClip: bind(ops.removeClip),
  duplicateClip: bind(ops.duplicateClip),

  setChannel: bindMode(ops.setChannel),
  setMaster: bindMode(ops.setMaster),

  endGesture: () => useWorkspace.getState().endGesture(),
  undo: () => useWorkspace.getState().undo(),
  redo: () => useWorkspace.getState().redo(),
};
