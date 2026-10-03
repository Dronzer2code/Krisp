// docs/TRD.md → DATA MODEL. Concept names: docs/PRD.md → CORE CONCEPTS.
export type Id = string;
export type SynthPreset = 'kick' | 'snare' | 'clap' | 'chh' | 'ohh' | 'tom' | 'rim' | 'crash';
export type SlotSound = { kind: 'synth'; preset: SynthPreset } | { kind: 'sample'; soundId: Id; name: string };
export type DrumPitch = 36 | 38 | 42 | 46 | 45 | 48 | 50 | 49 | 51; // Magenta drum pitch classes

export interface Slot { id: Id; name: string; color: string; sound: SlotSound; pitch: DrumPitch; tune: number; }
export interface Step { on: boolean; velocity: number; offset: number; } // velocity 1..127, offset -0.5..0.5 step
export interface Beat { id: Id; name: string; color: string; length: 16 | 32; steps: Record<Id, Step[]>; }

export interface BeatClip { id: Id; kind: 'beat'; laneId: Id; beatId: Id; startBar: number; lengthBars: number; }
export interface AudioClip { id: Id; kind: 'audio'; laneId: Id; soundId: Id; soundName: string; durationMs: number; startBar: number; lengthBars: number; gainDb: number; }
export type Clip = BeatClip | AudioClip;
export interface Lane { id: Id; name: string; type: 'BEAT' | 'AUDIO'; }

export interface EQ3 { low: number; mid: number; high: number; }
export interface Channel { volumeDb: number; pan: number; mute: boolean; solo: boolean; eq: EQ3; reverbSend: number; }
export interface Master {
  volumeDb: number; eq: EQ3;
  compressor: { enabled: boolean; threshold: number; ratio: number; attack: number; release: number };
  limiter: { enabled: boolean; ceiling: number };
  reverb: { decay: number; returnDb: number };
}

export type PlayMode = 'BEAT' | 'SONG';

export interface Workspace {
  id: Id | null; name: string; version: 1;
  bpm: number; swing: number; songBars: number;
  loop: { enabled: boolean; startBar: number; endBar: number };
  metronome: boolean; playMode: PlayMode;
  rack: Slot[]; beats: Beat[]; selectedBeatId: Id | null;
  lanes: Lane[]; clips: Clip[];
  mixer: { channels: Record<Id, Channel>; master: Master }; // key = slotId or AUDIO laneId
}

// Limits from docs/TRD.md → CONSTRAINTS.
export const BPM_MIN = 60;
export const BPM_MAX = 200;
export const SWING_MAX = 0.6;
export const SONG_BARS_MIN = 4;
export const SONG_BARS_MAX = 128;
export const TUNE_RANGE = 12;
