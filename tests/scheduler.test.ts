import { describe, expect, it } from 'vitest';
import { newWorkspace } from '../src/model/defaults';
import type { Workspace } from '../src/model/types';
import {
  audioStartsAt, barSeconds, beatClipAt, gridStepAt, hitTime, isSongEnd, stepSeconds, swingDelay, triggersAt, wrapTick,
} from '../src/audio/scheduler';
import * as ops from '../src/store/ops';

describe('timing', () => {
  it('stepSeconds / barSeconds', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125);
    expect(barSeconds(120)).toBeCloseTo(2);
    expect(barSeconds(90)).toBeCloseTo(2.6667, 3);
  });

  it('swing delays every second 16th by swing·step/2', () => {
    const sec = stepSeconds(120);
    expect(swingDelay(0, 0.5, sec)).toBe(0);
    expect(swingDelay(1, 0.5, sec)).toBeCloseTo(0.03125);
    expect(swingDelay(2, 0.5, sec)).toBe(0);
    expect(swingDelay(3, 0, sec)).toBe(0);
  });

  it('hitTime adds swing and offset, clamped to ≥ tick − 0.4·step', () => {
    const sec = 0.125;
    expect(hitTime(10, 1, { offset: 0 }, 0.5, sec)).toBeCloseTo(10.03125);
    expect(hitTime(10, 0, { offset: 0.2 }, 0, sec)).toBeCloseTo(10.025);
    expect(hitTime(10, 0, { offset: -0.5 }, 0, sec)).toBeCloseTo(10 - 0.4 * sec);
  });
});

function songWorkspace(): { w: Workspace; laneId: string; a: string; b: string; kick: string; snare: string } {
  let w = newWorkspace();
  const [kick, snare] = w.rack;
  const a = w.beats[0].id;
  w = ops.toggleStep(w, a, kick.id, 0);
  w = ops.addBeat(w);
  const b = w.beats[1].id;
  w = ops.toggleStep(w, b, snare.id, 4);
  const laneId = w.lanes[0].id;
  w = ops.addClip(w, { kind: 'beat', laneId, beatId: a, startBar: 0, lengthBars: 2 });
  w = ops.addClip(w, { kind: 'beat', laneId, beatId: b, startBar: 2, lengthBars: 1 });
  w = ops.setPlayMode(w, 'SONG');
  return { w, laneId, a, b, kick: kick.id, snare: snare.id };
}

describe('BEAT mode', () => {
  it('loops the selected Beat', () => {
    let w = newWorkspace();
    const kick = w.rack[0].id;
    w = ops.toggleStep(w, w.beats[0].id, kick, 3);
    expect(triggersAt(w, 3)).toEqual([{ slotId: kick, velocity: 100, offset: 0 }]);
    expect(triggersAt(w, 19)).toHaveLength(1);
    expect(triggersAt(w, 4)).toHaveLength(0);
    expect(gridStepAt(w, 35)).toBe(3);
  });

  it('32-step Beats use index t % 32', () => {
    let w = newWorkspace();
    const kick = w.rack[0].id;
    const id = w.beats[0].id;
    w = ops.setBeatLength(w, id, 32);
    w = ops.toggleStep(w, id, kick, 20);
    expect(triggersAt(w, 20)).toHaveLength(1);
    expect(triggersAt(w, 4)).toHaveLength(0);
  });
});

describe('SONG mode', () => {
  it('finds the clip on a lane at a bar', () => {
    const { w, laneId, a, b } = songWorkspace();
    expect(beatClipAt(w, laneId, 0)?.beatId).toBe(a);
    expect(beatClipAt(w, laneId, 1)?.beatId).toBe(a);
    expect(beatClipAt(w, laneId, 2)?.beatId).toBe(b);
    expect(beatClipAt(w, laneId, 3)).toBeUndefined();
  });

  it('repeats a 1-bar Beat across a longer clip and follows the arrangement', () => {
    const { w, kick, snare } = songWorkspace();
    expect(triggersAt(w, 0).map((t) => t.slotId)).toEqual([kick]);
    expect(triggersAt(w, 16).map((t) => t.slotId)).toEqual([kick]); // bar 2 = repeat of Beat A
    expect(triggersAt(w, 32 + 4).map((t) => t.slotId)).toEqual([snare]);
    expect(triggersAt(w, 32)).toHaveLength(0);
    expect(triggersAt(w, 48)).toHaveLength(0);
  });

  it('resizing a clip to 4 bars repeats the Beat 4 times (AC-F5.2)', () => {
    let { w } = songWorkspace();
    const { kick } = songWorkspace();
    void kick;
    const clip = w.clips[0];
    w = ops.removeClip(w, w.clips[1].id);
    w = ops.updateClip(w, clip.id, { lengthBars: 4 });
    const hits = [0, 16, 32, 48, 64].map((t) => triggersAt(w, t).length);
    expect(hits).toEqual([1, 1, 1, 1, 0]);
  });

  it('stops at songBars unless loop is on', () => {
    const { w } = songWorkspace();
    expect(isSongEnd(w, w.songBars * 16 - 1)).toBe(false);
    expect(isSongEnd(w, w.songBars * 16)).toBe(true);
    expect(isSongEnd({ ...w, loop: { enabled: true, startBar: 0, endBar: 2 } }, w.songBars * 16)).toBe(false);
  });
});

describe('loop wrap', () => {
  const loop = { enabled: true, startBar: 1, endBar: 3 };
  it('maps linear ticks into the loop region', () => {
    expect(wrapTick(0, loop)).toBe(0);
    expect(wrapTick(47, loop)).toBe(47);
    expect(wrapTick(48, loop)).toBe(16);
    expect(wrapTick(49, loop)).toBe(17);
    expect(wrapTick(80, loop)).toBe(16);
  });
  it('is identity when loop is disabled', () => {
    expect(wrapTick(500, { ...loop, enabled: false })).toBe(500);
  });
});

describe('audio clips', () => {
  function withAudio() {
    let w = ops.setPlayMode(newWorkspace(), 'SONG');
    const laneId = w.lanes[1].id;
    w = ops.setBpm(w, 120);
    w = ops.addClip(w, { kind: 'audio', laneId, soundId: 's1', soundName: 'loop', durationMs: 4000, startBar: 2, lengthBars: 2, gainDb: 0 });
    return w;
  }

  it('starts on its first bar with no offset', () => {
    const w = withAudio();
    expect(audioStartsAt(w, 31, false)).toHaveLength(0);
    const [a] = audioStartsAt(w, 32, false);
    expect(a.offsetSec).toBe(0);
    expect(a.durationSec).toBeCloseTo(4); // 2 bars at 120 BPM
    expect(audioStartsAt(w, 36, false)).toHaveLength(0);
  });

  it('starts mid-clip with an offset after a jump', () => {
    const w = withAudio();
    const [a] = audioStartsAt(w, 40, true);
    expect(a.offsetSec).toBeCloseTo(1); // 8 steps in at 0.125 s
    expect(a.durationSec).toBeCloseTo(3);
  });

  it('is silent in BEAT mode', () => {
    expect(audioStartsAt(ops.setPlayMode(withAudio(), 'BEAT'), 32, true)).toHaveLength(0);
  });
});
