import { emptyRow } from '../model/defaults';
import { newId } from '../model/ids';
import type { Beat, Slot, Step } from '../model/types';

// docs/TRD.md → PRESETS → Preset Beats. Row encoding (16 chars = one bar of 16ths):
// '.' off, 'g' 40, 's' 80, 'x' 100, 'X' 127. Rows map to default Rack Slots by name. Original patterns.

export const ROW_VELOCITY: Record<string, number> = { g: 40, s: 80, x: 100, X: 127 };

export interface PresetBeat {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  rows: Record<string, string>; // Slot name → 16-char row
}

export const PRESET_BEATS: PresetBeat[] = [
  {
    id: 'boom-bap', name: 'Boom Bap', bpm: 90, swing: 0.15,
    rows: { Kick: 'X.....x...x.....', Snare: '....X.......X...', 'Closed Hat': 'x.s.x.s.x.s.x.s.', 'Open Hat': '..............x.', Rim: '.......g......g.' },
  },
  {
    id: 'trap', name: 'Trap', bpm: 140, swing: 0,
    rows: { Kick: 'X......x..x.....', Snare: '........X.......', Clap: '........x.......', 'Closed Hat': 'x.x.x.x.xxx.x.xx', 'Open Hat': '......x.........' },
  },
  {
    id: 'house', name: 'House', bpm: 124, swing: 0,
    rows: { Kick: 'X...X...X...X...', Clap: '....x.......x...', 'Closed Hat': 's...s...s...s...', 'Open Hat': '..x...x...x...x.' },
  },
  {
    id: 'techno', name: 'Techno', bpm: 130, swing: 0,
    rows: { Kick: 'X...X...X...X...', Clap: '....s.......s...', 'Closed Hat': '..x...x...x...x.', Rim: '......x.......x.', 'Open Hat': '..............s.' },
  },
  {
    id: 'lo-fi', name: 'Lo-fi', bpm: 80, swing: 0.3,
    rows: { Kick: 'X......x.x......', Snare: '....x.......x..g', 'Closed Hat': 'x.s.x.s.x.s.x.s.', Rim: '..........g.....' },
  },
  {
    id: 'drill', name: 'Drill', bpm: 142, swing: 0,
    rows: { Kick: 'X.......x.x.....', Snare: '........X.....x.', 'Closed Hat': 'x..x..x.x..x..x.', Tom: '...........g..g.' },
  },
  {
    id: 'reggaeton', name: 'Reggaeton', bpm: 95, swing: 0,
    rows: { Kick: 'X...X...X...X...', Snare: '...x..x....x..x.', 'Closed Hat': 'x.x.x.x.x.x.x.x.' },
  },
  {
    id: 'dnb', name: 'Drum & Bass', bpm: 172, swing: 0,
    rows: { Kick: 'X.........x.....', Snare: '....X.......X...', 'Closed Hat': 'x.x.x.x.x.x.x.x.', Rim: '..g.....g....g..' },
  },
];

export function getPresetBeat(id: string): PresetBeat | undefined {
  return PRESET_BEATS.find((p) => p.id === id);
}

export function decodeRow(row: string): Step[] {
  return [...row].map((ch) => (ch === '.' ? { on: false, velocity: 100, offset: 0 } : { on: true, velocity: ROW_VELOCITY[ch], offset: 0 }));
}

// Builds a 16-step Beat for the given Rack. Rows whose Slot name is not in the Rack are skipped.
export function presetToBeat(preset: PresetBeat, rack: Slot[], color: string): Beat {
  const steps: Beat['steps'] = {};
  for (const slot of rack) {
    const row = preset.rows[slot.name];
    steps[slot.id] = row ? decodeRow(row) : emptyRow(16);
  }
  return { id: newId(), name: preset.name, color, length: 16, steps };
}
