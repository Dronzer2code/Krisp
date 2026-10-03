import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { buildMidi, collectHits } from '../src/audio/export-midi';
import { exportWorkspace } from '../src/audio/export-wav';
import * as ops from '../src/store/ops';

const ws = () => {
  let w = ops.createWorkspace('Test', 'boom-bap'); // clip: Boom Bap bars 1–4
  w = ops.setSwing(w, 0);
  return w;
};

describe('exportWorkspace', () => {
  it('Song range: SONG mode, no metronome, all bars', () => {
    const { ws: e, bars } = exportWorkspace({ ...ws(), metronome: true }, 'song');
    expect(bars).toBe(16);
    expect(e.playMode).toBe('SONG');
    expect(e.metronome).toBe(false);
    expect(e.clips).toHaveLength(1);
  });

  it('Loop range shifts clips so the region starts at bar 0', () => {
    let w = ws();
    w = ops.setLoop(w, { enabled: true, startBar: 2, endBar: 6 });
    const { ws: e, bars } = exportWorkspace(w, 'loop');
    expect(bars).toBe(4);
    expect(e.clips[0].startBar).toBe(-2); // clip bars 0–4 → starts 2 bars before the region
    expect(e.loop.enabled).toBe(false);
  });
});

describe('MIDI export', () => {
  it('selected Beat: GM drum notes at step times, tempo = BPM', () => {
    const w = ws();
    const hits = collectHits(w, 'beat');
    const kicks = hits.filter((h) => h.midi === 36).map((h) => h.time);
    const step = 60 / 90 / 4;
    expect(kicks.map((t) => Math.round(t / step))).toEqual([0, 6, 10]);
    const midi = new Midi(buildMidi(w, 'beat'));
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(90);
    expect(midi.tracks[0].channel).toBe(9);
    expect(midi.tracks[0].notes.length).toBe(hits.length);
    expect(new Set(midi.tracks[0].notes.map((n) => n.midi))).toEqual(new Set([36, 38, 42, 46, 37]));
  });

  it('Song: Beat clips repeat across their length', () => {
    const hits = collectHits(ws(), 'song');
    expect(hits.filter((h) => h.midi === 36)).toHaveLength(12); // 3 kicks × 4 bars
  });

  it('applies swing to odd 16ths', () => {
    const w = ops.setSwing(ws(), 0.5);
    const hat = collectHits(w, 'beat').find((h) => h.midi === 42 && h.time > 0)!;
    const step = 60 / 90 / 4;
    expect(hat.time).toBeCloseTo(2 * step, 5); // step 2 is even → no swing
    const rim = collectHits(w, 'beat').find((h) => h.midi === 37)!; // Rim on step 7 (odd)
    expect(rim.time).toBeCloseTo(7 * step + 0.5 * step / 2, 5);
  });
});
