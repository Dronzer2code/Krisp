import type { Beat, Id, Workspace } from '../model/types';
import { applyContinuation, applyHumanize, beatToNoteSequence, MODEL_STEPS, noteSequenceToBeat, STEPS_PER_QUARTER, type NoteSeq } from './convert';
import { getModel } from './magenta';

// docs/TRD.md → AI INTEGRATION; docs/PROCESS_FLOW.md J9. Every tool returns new `steps`; the caller pushes the
// result through the store (one undo entry). Models load lazily and are cached (src/ai/magenta.ts).

export interface Candidate {
  steps: Beat['steps'];
  length: 16 | 32;
}

function beatOf(w: Workspace, beatId: Id): Beat {
  const b = w.beats.find((x) => x.id === beatId);
  if (!b) throw new Error('beat_not_found');
  return b;
}

/** Humanize: GrooVAE encode → decode; copies velocity/offset onto active steps only. */
export async function humanize(w: Workspace, beatId: Id): Promise<Candidate> {
  const beat = beatOf(w, beatId);
  const model = await getModel('groove');
  const seq = beatToNoteSequence(beat, w.rack, w.bpm);
  const z = await model.encode([seq as never]);
  try {
    const [out] = await model.decode(z, undefined, undefined, STEPS_PER_QUARTER, w.bpm);
    return { steps: applyHumanize(out as NoteSeq, beat, w.rack, w.bpm), length: beat.length };
  } finally {
    z.dispose();
  }
}

/** Variations: MusicVAE.similar(seq, 4, similarity = 1 − wildness·0.6, temperature = 0.2 + wildness·0.8). */
export async function variations(w: Workspace, beatId: Id, wildness: number, keepTwoBars: boolean): Promise<Candidate[]> {
  const beat = beatOf(w, beatId);
  const model = await getModel('vae');
  const seq = beatToNoteSequence(beat, w.rack, w.bpm);
  const out = await model.similar(seq as never, 4, 1 - wildness * 0.6, 0.2 + wildness * 0.8);
  const length: 16 | 32 = beat.length === 32 || keepTwoBars ? 32 : 16;
  return out.map((s) => ({ steps: noteSequenceToBeat(s as NoteSeq, beat, w.rack, { bpm: w.bpm, length }), length }));
}

/** Continue: seed = bar 1 → MusicRNN.continueSequence(seed, 16, 1.0) → bar 2. Beat length becomes 32. */
export async function continueBeat(w: Workspace, beatId: Id): Promise<Candidate> {
  const beat = beatOf(w, beatId);
  const model = await getModel('rnn');
  const seed = beatToNoteSequence(beat, w.rack, w.bpm, 16);
  const out = await model.continueSequence(seed as never, 16, 1.0);
  return { steps: applyContinuation(out as NoteSeq, beat, w.rack, w.bpm), length: 32 };
}

/** Morph: MusicVAE.interpolate([A, B], 9) → 9 Beats from A to B. */
export async function morph(w: Workspace, aId: Id, bId: Id): Promise<Candidate[]> {
  const a = beatOf(w, aId);
  const b = beatOf(w, bId);
  const model = await getModel('vae');
  const out = await model.interpolate([beatToNoteSequence(a, w.rack, w.bpm) as never, beatToNoteSequence(b, w.rack, w.bpm) as never], 9);
  const length: 16 | 32 = a.length === 32 || b.length === 32 ? 32 : 16;
  return out.map((s) => ({ steps: noteSequenceToBeat(s as NoteSeq, a, w.rack, { bpm: w.bpm, length, preserveUnmapped: false }), length }));
}

export { MODEL_STEPS };
