import { emptyRow, PITCH_ORDER } from '../model/defaults';
import type { Beat, Slot, Step } from '../model/types';

// docs/TRD.md → AI INTEGRATION → Conversion. Facts from VERIFY-2: VAE/RNN output is quantized with velocity unset
// (reads 0 → default 100); GrooVAE output is unquantized (startTime + velocity); continueSequence returns only the
// new steps, numbered from 0.

export const STEPS_PER_QUARTER = 4;
export const MODEL_STEPS = 32;

export interface Note {
  pitch?: number | null;
  velocity?: number | null;
  quantizedStartStep?: number | null;
  quantizedEndStep?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  isDrum?: boolean | null;
}

export interface NoteSeq {
  notes?: Note[] | null;
  quantizationInfo?: { stepsPerQuarter?: number | null } | null;
  totalQuantizedSteps?: number | null;
  tempos?: { time?: number | null; qpm?: number | null }[] | null;
  totalTime?: number | null;
}

/** Quantized 2-bar NoteSequence; 16-step Beats are duplicated to fill 32 steps. `steps` limits the length (seeds). */
export function beatToNoteSequence(beat: Beat, rack: Slot[], bpm: number, steps = MODEL_STEPS): NoteSeq {
  const notes: Note[] = [];
  for (let i = 0; i < steps; i++) {
    const src = i % beat.length;
    for (const slot of rack) {
      const st = beat.steps[slot.id]?.[src];
      if (st?.on) notes.push({ pitch: slot.pitch, velocity: st.velocity, quantizedStartStep: i, quantizedEndStep: i + 1, isDrum: true });
    }
  }
  return {
    notes,
    quantizationInfo: { stepsPerQuarter: STEPS_PER_QUARTER },
    totalQuantizedSteps: steps,
    tempos: [{ time: 0, qpm: bpm }],
  };
}

/**
 * The Slot that receives model notes for a pitch: the first Slot with exactly that pitch, else the Slot whose
 * pitch is nearest in PITCH_ORDER (list order), else numerically nearest.
 */
export function slotForPitch(pitch: number, rack: Slot[]): Slot | undefined {
  const exact = rack.find((s) => s.pitch === pitch);
  if (exact) return exact;
  const idx = PITCH_ORDER.indexOf(pitch as Slot['pitch']);
  let best: Slot | undefined;
  let bestD = Infinity;
  for (const s of rack) {
    const d = idx >= 0 ? Math.abs(PITCH_ORDER.indexOf(s.pitch) - idx) : Math.abs(s.pitch - pitch);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Slots that receive model output: the first Slot per pitch. Later Slots with the same pitch keep their steps. */
function receivers(rack: Slot[]): Set<string> {
  const seen = new Set<number>();
  const ids = new Set<string>();
  for (const s of rack) {
    if (!seen.has(s.pitch)) {
      seen.add(s.pitch);
      ids.add(s.id);
    }
  }
  return ids;
}

interface MappedNote {
  slotId: string;
  step: number;
  velocity: number;
  offset: number;
}

/** Converts model notes to (Slot, step) hits. Quantized notes → offset 0; unquantized → step + microtiming offset. */
export function mapNotes(seq: NoteSeq, rack: Slot[], bpm: number, stepShift = 0): MappedNote[] {
  const stepSec = 60 / bpm / STEPS_PER_QUARTER;
  const recv = receivers(rack);
  const out: MappedNote[] = [];
  for (const n of seq.notes ?? []) {
    if (n.pitch == null) continue;
    const slot = slotForPitch(n.pitch, rack.filter((s) => recv.has(s.id)));
    if (!slot) continue;
    let step: number;
    let offset = 0;
    if (n.quantizedStartStep != null && (n.startTime == null || n.startTime === 0) && (seq.quantizationInfo?.stepsPerQuarter ?? 0) > 0) {
      step = n.quantizedStartStep;
    } else {
      const pos = (n.startTime ?? 0) / stepSec;
      step = Math.round(pos);
      offset = Math.max(-0.5, Math.min(0.5, pos - step));
    }
    const velocity = n.velocity && n.velocity > 0 ? Math.max(1, Math.min(127, Math.round(n.velocity))) : 100;
    out.push({ slotId: slot.id, step: step + stepShift, velocity, offset });
  }
  return out;
}

export interface ToBeatOptions {
  bpm: number;
  length: 16 | 32;
  /** Slots whose pitch is absent from the output keep their original steps (default true). */
  preserveUnmapped?: boolean;
}

/** Builds a new `steps` map from model output (Variations, Morph, Continue). */
export function noteSequenceToBeat(seq: NoteSeq, beat: Beat, rack: Slot[], opts: ToBeatOptions): Beat['steps'] {
  const { length, preserveUnmapped = true } = opts;
  const hits = mapNotes(seq, rack, opts.bpm).filter((h) => h.step >= 0 && h.step < length);
  const recv = receivers(rack);
  const pitchesInOutput = new Set((seq.notes ?? []).map((n) => n.pitch));
  const steps: Beat['steps'] = {};
  for (const slot of rack) {
    const keep = !recv.has(slot.id) || (preserveUnmapped && !pitchesInOutput.has(slot.pitch));
    steps[slot.id] = keep ? resize(beat.steps[slot.id] ?? emptyRow(beat.length), beat.length, length) : emptyRow(length);
  }
  for (const h of hits) {
    const row = steps[h.slotId];
    if (!recv.has(h.slotId) || !row) continue;
    const prev = row[h.step];
    if (!prev.on || h.velocity > prev.velocity) row[h.step] = { on: true, velocity: h.velocity, offset: h.offset };
  }
  return steps;
}

/** Repeats or truncates a row to a new length (16 → 32 copies bar 1). */
function resize(row: Step[], from: number, to: number): Step[] {
  return Array.from({ length: to }, (_, i) => ({ ...(row[i % from] ?? { on: false, velocity: 100, offset: 0 }) }));
}

/**
 * Humanize: copies only velocity and offset from GrooVAE output onto steps that are already on.
 * Never changes on/off. Steps without a matching output note keep their values.
 */
export function applyHumanize(seq: NoteSeq, beat: Beat, rack: Slot[], bpm: number): Beat['steps'] {
  const byKey = new Map<string, MappedNote>();
  for (const h of mapNotes(seq, rack, bpm)) {
    if (h.step < 0 || h.step >= beat.length) continue; // 16-step Beats: second model bar is dropped
    byKey.set(`${h.slotId}:${h.step}`, h);
  }
  // Slots sharing a pitch with the receiving Slot take the same feel.
  const recvForPitch = new Map<number, string>();
  for (const s of rack) if (!recvForPitch.has(s.pitch)) recvForPitch.set(s.pitch, s.id);
  const steps: Beat['steps'] = {};
  for (const slot of rack) {
    const row = beat.steps[slot.id] ?? emptyRow(beat.length);
    const recvId = recvForPitch.get(slot.pitch)!;
    steps[slot.id] = row.map((st, i) => {
      if (!st.on) return st;
      const h = byKey.get(`${recvId}:${i}`);
      return h ? { on: true, velocity: h.velocity, offset: h.offset } : st;
    });
  }
  return steps;
}

/** Continue: bar 1 stays; the model's 16 new steps become bar 2 (Beat length 32). */
export function applyContinuation(continuation: NoteSeq, beat: Beat, rack: Slot[], bpm: number): Beat['steps'] {
  const recv = receivers(rack);
  const steps: Beat['steps'] = {};
  for (const slot of rack) {
    const bar1 = (beat.steps[slot.id] ?? emptyRow(beat.length)).slice(0, 16).map((s) => ({ ...s }));
    const bar2 = recv.has(slot.id) ? emptyRow(16) : bar1.map((s) => ({ ...s }));
    steps[slot.id] = [...bar1, ...bar2];
  }
  for (const h of mapNotes(continuation, rack, bpm, 16)) {
    if (h.step < 16 || h.step >= 32 || !recv.has(h.slotId)) continue;
    steps[h.slotId][h.step] = { on: true, velocity: h.velocity, offset: 0 };
  }
  return steps;
}
