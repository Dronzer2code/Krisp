import { newId } from './ids';
import type { Beat, Channel, DrumPitch, Lane, Master, Slot, SynthPreset, Step, Workspace } from './types';

// docs/TRD.md → DATA MODEL → Defaults.

export const PITCH_ORDER: DrumPitch[] = [36, 38, 42, 46, 45, 48, 50, 49, 51];

// Palette for Slots and Beats (default Rack colours first).
export const PALETTE = ['#E4572E', '#F3A712', '#E9C46A', '#2A9D8F', '#4FB3A9', '#6C8EBF', '#9B7EDE', '#A8A29E', '#D16BA5', '#7FB069'];

export const DEFAULT_RACK: { name: string; preset: SynthPreset; pitch: DrumPitch; color: string }[] = [
  { name: 'Kick', preset: 'kick', pitch: 36, color: '#E4572E' },
  { name: 'Snare', preset: 'snare', pitch: 38, color: '#F3A712' },
  { name: 'Clap', preset: 'clap', pitch: 38, color: '#E9C46A' },
  { name: 'Closed Hat', preset: 'chh', pitch: 42, color: '#2A9D8F' },
  { name: 'Open Hat', preset: 'ohh', pitch: 46, color: '#4FB3A9' },
  { name: 'Tom', preset: 'tom', pitch: 45, color: '#6C8EBF' },
  { name: 'Rim', preset: 'rim', pitch: 50, color: '#9B7EDE' },
  { name: 'Crash', preset: 'crash', pitch: 49, color: '#A8A29E' },
];

export const VELOCITY_CYCLE = [100, 127, 40, 80] as const; // AC-F4.2: 100 → 127 → 40 → 80 → 100

export function defaultChannel(): Channel {
  return { volumeDb: 0, pan: 0, mute: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, reverbSend: 0 };
}

export function defaultMaster(): Master {
  return {
    volumeDb: 0,
    eq: { low: 0, mid: 0, high: 0 },
    compressor: { enabled: true, threshold: -18, ratio: 3, attack: 0.01, release: 0.2 },
    limiter: { enabled: true, ceiling: -1 },
    reverb: { decay: 2.5, returnDb: -6 },
  };
}

export function emptyStep(): Step {
  return { on: false, velocity: 100, offset: 0 };
}

export function emptyRow(length: number): Step[] {
  return Array.from({ length }, emptyStep);
}

export function defaultRack(): Slot[] {
  return DEFAULT_RACK.map((s) => ({
    id: newId(),
    name: s.name,
    color: s.color,
    sound: { kind: 'synth', preset: s.preset },
    pitch: s.pitch,
    tune: 0,
  }));
}

export function emptyBeat(rack: Slot[], name: string, color: string, length: 16 | 32 = 16): Beat {
  const steps: Beat['steps'] = {};
  for (const slot of rack) steps[slot.id] = emptyRow(length);
  return { id: newId(), name, color, length, steps };
}

export function nextPitch(rack: Slot[]): DrumPitch {
  const used = new Set(rack.map((s) => s.pitch));
  return PITCH_ORDER.find((p) => !used.has(p)) ?? 38;
}

export function nextColor(used: string[]): string {
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length];
}

export function defaultLanes(): Lane[] {
  return [
    { id: newId(), name: 'Beats 1', type: 'BEAT' },
    { id: newId(), name: 'Audio 1', type: 'AUDIO' },
  ];
}

export function newWorkspace(name = 'Untitled beat'): Workspace {
  const rack = defaultRack();
  const beat = emptyBeat(rack, 'Beat 1', PALETTE[0]);
  const lanes = defaultLanes();
  const channels: Workspace['mixer']['channels'] = {};
  for (const slot of rack) channels[slot.id] = defaultChannel();
  for (const lane of lanes) if (lane.type === 'AUDIO') channels[lane.id] = defaultChannel();
  return {
    id: null,
    name,
    version: 1,
    bpm: 90,
    swing: 0,
    songBars: 16,
    loop: { enabled: false, startBar: 0, endBar: 4 },
    metronome: false,
    playMode: 'BEAT',
    rack,
    beats: [beat],
    selectedBeatId: beat.id,
    lanes,
    clips: [],
    mixer: { channels, master: defaultMaster() },
  };
}
