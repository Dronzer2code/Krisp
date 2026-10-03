import { describe, expect, it } from 'vitest';
import { DEFAULT_RACK, defaultRack } from '../src/model/defaults';
import { decodeRow, PRESET_BEATS, presetToBeat } from '../src/presets/beats';
import { KIT, KIT_ORDER } from '../src/presets/kit';

const slotNames = new Set(DEFAULT_RACK.map((s) => s.name));

describe('preset beats', () => {
  it('has the 8 presets from the TRD', () => {
    expect(PRESET_BEATS.map((p) => p.name)).toEqual(['Boom Bap', 'Trap', 'House', 'Techno', 'Lo-fi', 'Drill', 'Reggaeton', 'Drum & Bass']);
  });

  for (const preset of PRESET_BEATS) {
    describe(preset.name, () => {
      it('every row is exactly 16 chars of .gsxX', () => {
        for (const row of Object.values(preset.rows)) expect(row).toMatch(/^[.gsxX]{16}$/);
      });
      it('every row maps to an existing default Slot name', () => {
        for (const name of Object.keys(preset.rows)) expect(slotNames.has(name)).toBe(true);
      });
      it('BPM and swing within limits', () => {
        expect(preset.bpm).toBeGreaterThanOrEqual(60);
        expect(preset.bpm).toBeLessThanOrEqual(200);
        expect(preset.swing).toBeGreaterThanOrEqual(0);
        expect(preset.swing).toBeLessThanOrEqual(0.6);
      });
    });
  }

  it('decodes velocities', () => {
    const steps = decodeRow('.gsxX...........');
    expect(steps.slice(0, 5).map((s) => (s.on ? s.velocity : 0))).toEqual([0, 40, 80, 100, 127]);
  });

  it('builds a Beat with a row for every Slot', () => {
    const rack = defaultRack();
    const beat = presetToBeat(PRESET_BEATS[0], rack, '#000000');
    expect(beat.length).toBe(16);
    expect(Object.keys(beat.steps).sort()).toEqual(rack.map((s) => s.id).sort());
    const kick = rack.find((s) => s.name === 'Kick')!;
    expect(beat.steps[kick.id][0]).toEqual({ on: true, velocity: 127, offset: 0 });
    const crash = rack.find((s) => s.name === 'Crash')!;
    expect(beat.steps[crash.id].every((s) => !s.on)).toBe(true);
  });
});

describe('synth kit', () => {
  it('has a recipe for every SynthPreset with the TRD MIDI notes', () => {
    expect(KIT_ORDER.map((p) => KIT[p].midiNote)).toEqual([36, 38, 39, 42, 46, 45, 37, 49]);
  });
});
