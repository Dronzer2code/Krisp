import { describe, expect, it } from 'vitest';
import { beatMapPaths } from '../src/screens/workspace/ClipView';
import { bakeLevel, SAMPLE_POLYPHONY } from '../src/audio/voices';
import { newWorkspace } from '../src/model/defaults';

describe('baked hat velocity levels', () => {
  it('keeps the four pad velocities exact', () => {
    for (const v of [40, 80, 100, 127]) expect(bakeLevel(v)).toBe(v);
  });
  it('rounds other velocities to the nearest 8 within 1..127', () => {
    expect(bakeLevel(23)).toBe(24);
    expect(bakeLevel(113)).toBe(112);
    expect(bakeLevel(1)).toBe(8);
    expect(bakeLevel(126)).toBe(127);
    expect(bakeLevel(500)).toBe(127);
  });
  it('caps overlapping sample hits', () => {
    expect(SAMPLE_POLYPHONY).toBeGreaterThanOrEqual(2);
    expect(SAMPLE_POLYPHONY).toBeLessThanOrEqual(8);
  });
});

describe('clip mini map', () => {
  it('draws one path per velocity level, not one element per cell', () => {
    const w = newWorkspace();
    const beat = { ...w.beats[0], steps: Object.fromEntries(w.rack.map((s) => [s.id, Array.from({ length: 16 }, () => ({ on: true, velocity: 100, offset: 0 }))])) };
    const { rows, paths } = beatMapPaths(beat, w.rack, 8);
    expect(rows).toBe(w.rack.length);
    expect(paths).toHaveLength(1); // every cell at velocity 100
    expect((paths[0][1].match(/M/g) ?? []).length).toBe(w.rack.length * 16 * 8); // 8 bars of a full 16-step beat
  });
  it('skips rows without hits', () => {
    const w = newWorkspace();
    const beat = { ...w.beats[0], steps: {} };
    expect(beatMapPaths(beat, w.rack, 4)).toMatchObject({ rows: 0, paths: [] });
  });
});
