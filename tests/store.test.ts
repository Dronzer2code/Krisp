import { beforeEach, describe, expect, it } from 'vitest';
import { newWorkspace } from '../src/model/defaults';
import type { Workspace } from '../src/model/types';
import { HISTORY_LIMIT } from '../src/store/history';
import * as ops from '../src/store/ops';
import { isChannelSilenced } from '../src/store/selectors';
import { actions, canRedo, canUndo, useWorkspace } from '../src/store/workspace';

const ws = () => useWorkspace.getState().workspace;
const beat0 = (w: Workspace) => w.beats[0];

beforeEach(() => useWorkspace.getState().load(newWorkspace('Test')));

describe('defaults', () => {
  it('new Workspace has the 8-Slot default kit in order and a Channel per Slot + AUDIO lane', () => {
    const w = newWorkspace();
    expect(w.rack.map((s) => s.name)).toEqual(['Kick', 'Snare', 'Clap', 'Closed Hat', 'Open Hat', 'Tom', 'Rim', 'Crash']);
    expect(w.rack.map((s) => s.pitch)).toEqual([36, 38, 38, 42, 46, 45, 50, 49]);
    expect(w.bpm).toBe(90);
    expect(w.lanes.map((l) => `${l.type}:${l.name}`)).toEqual(['BEAT:Beats 1', 'AUDIO:Audio 1']);
    expect(Object.keys(w.mixer.channels)).toHaveLength(9);
    expect(w.beats).toHaveLength(1);
    expect(w.selectedBeatId).toBe(w.beats[0].id);
  });

  it('createWorkspace from preset applies BPM/swing and places the Beat for 4 bars', () => {
    const w = ops.createWorkspace('Boom', 'boom-bap');
    expect(w.bpm).toBe(90);
    expect(w.swing).toBe(0.15);
    expect(w.beats[0].name).toBe('Boom Bap');
    expect(w.selectedBeatId).toBe(w.beats[0].id);
    expect(w.clips).toEqual([expect.objectContaining({ kind: 'beat', beatId: w.beats[0].id, startBar: 0, lengthBars: 4 })]);
  });
});

describe('slots', () => {
  it('addSlot adds a row to every Beat and a Channel; next unused pitch', () => {
    actions.addBeat();
    actions.addSlot({ kind: 'synth', preset: 'kick' }, 'Kick 2');
    const w = ws();
    const slot = w.rack[w.rack.length - 1];
    expect(slot.pitch).toBe(48);
    for (const b of w.beats) expect(b.steps[slot.id]).toHaveLength(b.length);
    expect(w.mixer.channels[slot.id]).toBeDefined();
  });

  it('removeSlot removes its steps in all Beats and its Channel', () => {
    actions.addBeat();
    const id = ws().rack[1].id;
    actions.removeSlot(id);
    const w = ws();
    expect(w.rack.some((s) => s.id === id)).toBe(false);
    for (const b of w.beats) expect(b.steps[id]).toBeUndefined();
    expect(w.mixer.channels[id]).toBeUndefined();
  });

  it('tune is clamped to ±12', () => {
    const id = ws().rack[0].id;
    actions.updateSlot('push', id, { tune: 20 });
    expect(ws().rack[0].tune).toBe(12);
  });
});

describe('beat editing', () => {
  it('toggle and velocity cycle 100 → 127 → 40 → 80 → 100', () => {
    const b = beat0(ws());
    const s = ws().rack[0].id;
    actions.toggleStep(b.id, s, 3);
    const seen = [beat0(ws()).steps[s][3].velocity];
    for (let i = 0; i < 4; i++) {
      actions.cycleVelocity(b.id, s, 3);
      seen.push(beat0(ws()).steps[s][3].velocity);
    }
    expect(seen).toEqual([100, 127, 40, 80, 100]);
  });

  it('16 → 32 copies bar 1 into bar 2', () => {
    const b = beat0(ws());
    const s = ws().rack[0].id;
    actions.toggleStep(b.id, s, 2);
    actions.cycleVelocity(b.id, s, 2);
    actions.setBeatLength(b.id, 32);
    const row = beat0(ws()).steps[s];
    expect(row).toHaveLength(32);
    expect(row[18]).toEqual(row[2]);
    expect(row[18]).not.toBe(row[2]);
    expect(beat0(ws()).length).toBe(32);
  });

  it('insert preset adds a new Beat without altering existing ones', () => {
    const b = beat0(ws());
    actions.toggleStep(b.id, ws().rack[0].id, 0);
    const before = ws().beats[0];
    const bpm = ws().bpm;
    actions.insertPresetBeat('trap');
    expect(ws().beats).toHaveLength(2);
    expect(ws().beats[0]).toBe(before);
    expect(ws().beats[1].name).toBe('Trap');
    expect(ws().selectedBeatId).toBe(ws().beats[1].id);
    expect(ws().bpm).toBe(bpm); // not pristine → BPM unchanged
  });

  it('insert preset into a pristine Workspace applies its BPM/swing', () => {
    actions.insertPresetBeat('house');
    expect(ws().bpm).toBe(124);
  });

  it('clearRow and clearBeat', () => {
    const b = beat0(ws());
    const [k, sn] = ws().rack;
    actions.toggleStep(b.id, k.id, 0);
    actions.toggleStep(b.id, sn.id, 4);
    actions.clearRow(b.id, k.id);
    expect(beat0(ws()).steps[k.id].some((s) => s.on)).toBe(false);
    expect(beat0(ws()).steps[sn.id][4].on).toBe(true);
    actions.clearBeat(b.id);
    expect(Object.values(beat0(ws()).steps).every((r) => r.every((s) => !s.on))).toBe(true);
  });
});

describe('beats and clips', () => {
  it('deleting a Beat removes its clips; the last Beat cannot be deleted', () => {
    const lane = ws().lanes[0];
    actions.addBeat();
    const b2 = ws().beats[1];
    actions.addClip({ kind: 'beat', laneId: lane.id, beatId: b2.id, startBar: 0, lengthBars: 1 });
    actions.addClip({ kind: 'beat', laneId: lane.id, beatId: ws().beats[0].id, startBar: 1, lengthBars: 1 });
    actions.deleteBeat(b2.id);
    expect(ws().beats).toHaveLength(1);
    expect(ws().clips).toHaveLength(1);
    actions.deleteBeat(ws().beats[0].id);
    expect(ws().beats).toHaveLength(1);
  });

  it('beat clips only go on BEAT lanes; songBars auto-extends', () => {
    const [beatLane, audioLane] = ws().lanes;
    const b = beat0(ws());
    actions.addClip({ kind: 'beat', laneId: audioLane.id, beatId: b.id, startBar: 0, lengthBars: 1 });
    expect(ws().clips).toHaveLength(0);
    actions.addClip({ kind: 'beat', laneId: beatLane.id, beatId: b.id, startBar: 18, lengthBars: 4 });
    expect(ws().songBars).toBe(22);
  });

  it('removing a Lane removes its clips and AUDIO Channel', () => {
    const audio = ws().lanes[1];
    actions.addClip({ kind: 'audio', laneId: audio.id, soundId: 'x', soundName: 'loop', durationMs: 2000, startBar: 0, lengthBars: 2, gainDb: 0 });
    actions.removeLane(audio.id);
    expect(ws().clips).toHaveLength(0);
    expect(ws().mixer.channels[audio.id]).toBeUndefined();
  });
});

describe('mixer', () => {
  it('solo silences all non-soloed Channels', () => {
    const [k, sn] = ws().rack;
    actions.setChannel('push', sn.id, { solo: true });
    expect(isChannelSilenced(ws(), k.id)).toBe(true);
    expect(isChannelSilenced(ws(), sn.id)).toBe(false);
    expect(isChannelSilenced(ws(), ws().lanes[1].id)).toBe(true);
  });
});

describe('undo / redo', () => {
  it('undo reverts the last edit of any kind; redo re-applies', () => {
    const b = beat0(ws());
    const s = ws().rack[0].id;
    actions.toggleStep(b.id, s, 0);
    actions.setChannel('push', s, { volumeDb: -6 });
    actions.undo();
    expect(ws().mixer.channels[s].volumeDb).toBe(0);
    expect(beat0(ws()).steps[s][0].on).toBe(true);
    actions.undo();
    expect(beat0(ws()).steps[s][0].on).toBe(false);
    actions.redo();
    expect(beat0(ws()).steps[s][0].on).toBe(true);
    expect(canRedo(useWorkspace.getState())).toBe(true);
    actions.toggleStep(b.id, s, 1);
    expect(canRedo(useWorkspace.getState())).toBe(false);
  });

  it('silent edits (selection, play mode) do not create undo entries', () => {
    actions.setPlayMode('SONG');
    expect(canUndo(useWorkspace.getState())).toBe(false);
    expect(ws().playMode).toBe('SONG');
  });

  it('a drag of many steps is one undo entry (coalescing)', () => {
    const s = ws().rack[0].id;
    for (let v = -1; v >= -12; v--) actions.setChannel('gesture', s, { volumeDb: v });
    actions.endGesture();
    expect(ws().mixer.channels[s].volumeDb).toBe(-12);
    expect(useWorkspace.getState().history.past).toHaveLength(1);
    actions.undo();
    expect(ws().mixer.channels[s].volumeDb).toBe(0);
  });

  it('undo during an open gesture closes it first', () => {
    const s = ws().rack[0].id;
    actions.setChannel('gesture', s, { volumeDb: -3 });
    actions.setChannel('gesture', s, { volumeDb: -4 });
    actions.undo();
    expect(ws().mixer.channels[s].volumeDb).toBe(0);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    const s = ws().rack[0].id;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) actions.setChannel('push', s, { volumeDb: -(i % 50) - 1 });
    expect(useWorkspace.getState().history.past).toHaveLength(HISTORY_LIMIT);
  });

  it('no-op edits do not create history or revisions', () => {
    const rev = useWorkspace.getState().revision;
    actions.setBpm('push', 90);
    expect(useWorkspace.getState().revision).toBe(rev);
    expect(canUndo(useWorkspace.getState())).toBe(false);
  });
});
