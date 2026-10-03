import { describe, expect, it } from 'vitest';
import { applyContinuation, applyHumanize, beatToNoteSequence, noteSequenceToBeat, slotForPitch } from '../src/ai/convert';
import { defaultRack, emptyBeat } from '../src/model/defaults';
import type { Beat } from '../src/model/types';
import { PRESET_BEATS, presetToBeat } from '../src/presets/beats';

const rack = defaultRack();
const byName = (n: string) => rack.find((s) => s.name === n)!;
const boomBap = presetToBeat(PRESET_BEATS[0], rack, '#000');
const onSteps = (b: Beat['steps'], slot: string) => b[slot].map((s, i) => (s.on ? i : -1)).filter((i) => i >= 0);

describe('beatToNoteSequence', () => {
  it('builds a quantized 32-step sequence, duplicating 16-step Beats', () => {
    const seq = beatToNoteSequence(boomBap, rack, 90);
    expect(seq.totalQuantizedSteps).toBe(32);
    expect(seq.quantizationInfo?.stepsPerQuarter).toBe(4);
    expect(seq.tempos?.[0].qpm).toBe(90);
    const kicks = seq.notes!.filter((n) => n.pitch === 36).map((n) => n.quantizedStartStep);
    expect(kicks).toEqual([0, 6, 10, 16, 22, 26]);
    expect(seq.notes!.every((n) => n.isDrum && n.quantizedEndStep === n.quantizedStartStep! + 1)).toBe(true);
  });
});

describe('noteSequenceToBeat', () => {
  it('round-trip preserves steps for mapped pitches', () => {
    const seq = beatToNoteSequence(boomBap, rack, 90);
    const steps = noteSequenceToBeat(seq, boomBap, rack, { bpm: 90, length: 16 });
    for (const name of ['Kick', 'Snare', 'Closed Hat', 'Open Hat', 'Rim']) {
      expect(steps[byName(name).id]).toEqual(boomBap.steps[byName(name).id]);
    }
  });

  it('keeps 2 bars when length is 32', () => {
    const seq = beatToNoteSequence(boomBap, rack, 90);
    const steps = noteSequenceToBeat(seq, boomBap, rack, { bpm: 90, length: 32 });
    expect(onSteps(steps, byName('Kick').id)).toEqual([0, 6, 10, 16, 22, 26]);
  });

  it('defaults unset velocities (model output) to 100', () => {
    const seq = { notes: [{ pitch: 36, quantizedStartStep: 3, velocity: 0 }], quantizationInfo: { stepsPerQuarter: 4 } };
    const steps = noteSequenceToBeat(seq, emptyBeat(rack, 'x', '#000'), rack, { bpm: 90, length: 16 });
    expect(steps[byName('Kick').id][3]).toEqual({ on: true, velocity: 100, offset: 0 });
  });

  it('Slots whose pitch is absent from the output keep their steps', () => {
    const seq = { notes: [{ pitch: 36, quantizedStartStep: 0 }], quantizationInfo: { stepsPerQuarter: 4 } };
    const steps = noteSequenceToBeat(seq, boomBap, rack, { bpm: 90, length: 16 });
    expect(onSteps(steps, byName('Kick').id)).toEqual([0]);
    expect(steps[byName('Closed Hat').id]).toEqual(boomBap.steps[byName('Closed Hat').id]);
  });

  it('a second Slot sharing a pitch (Clap, 38) keeps its own steps', () => {
    const trap = presetToBeat(PRESET_BEATS[1], rack, '#000');
    const seq = { notes: [{ pitch: 38, quantizedStartStep: 4 }], quantizationInfo: { stepsPerQuarter: 4 } };
    const steps = noteSequenceToBeat(seq, trap, rack, { bpm: 140, length: 16 });
    expect(onSteps(steps, byName('Snare').id)).toEqual([4]);
    expect(steps[byName('Clap').id]).toEqual(trap.steps[byName('Clap').id]);
  });

  it('maps unknown pitches to the nearest Slot in pitch-class order', () => {
    expect(slotForPitch(48, rack)?.name).toBe('Tom'); // 48 (hi tom) → nearest listed is 45
    expect(slotForPitch(51, rack)?.name).toBe('Crash');
  });
});

describe('applyHumanize', () => {
  it('copies velocity and offset onto active steps only, never toggling', () => {
    const bpm = 90;
    const stepSec = 60 / bpm / 4;
    const seq = {
      notes: [
        { pitch: 36, startTime: 0 * stepSec + 0.2 * stepSec, velocity: 88 },
        { pitch: 36, startTime: 6 * stepSec - 0.1 * stepSec, velocity: 70 },
        { pitch: 36, startTime: 3 * stepSec, velocity: 90 }, // step 3 is off → ignored
        { pitch: 36, startTime: 16 * stepSec, velocity: 50 }, // second bar dropped for 16-step Beats
      ],
    };
    const steps = applyHumanize(seq, boomBap, rack, bpm);
    const kick = steps[byName('Kick').id];
    expect(kick[0].velocity).toBe(88);
    expect(kick[0].offset).toBeCloseTo(0.2, 5);
    expect(kick[6].velocity).toBe(70);
    expect(kick[6].offset).toBeCloseTo(-0.1, 5);
    expect(kick[3].on).toBe(false);
    expect(kick[10]).toEqual(boomBap.steps[byName('Kick').id][10]); // no output note → unchanged
    expect(onSteps(steps, byName('Kick').id)).toEqual(onSteps(boomBap.steps, byName('Kick').id));
  });
});

describe('applyContinuation', () => {
  it('keeps bar 1 and writes the continuation into bar 2', () => {
    const seq = { notes: [{ pitch: 36, quantizedStartStep: 0 }, { pitch: 38, quantizedStartStep: 4 }], quantizationInfo: { stepsPerQuarter: 4 } };
    const steps = applyContinuation(seq, boomBap, rack, 90);
    expect(steps[byName('Kick').id]).toHaveLength(32);
    expect(onSteps(steps, byName('Kick').id)).toEqual([0, 6, 10, 16]);
    expect(onSteps(steps, byName('Snare').id)).toEqual([4, 12, 20]);
  });
});
