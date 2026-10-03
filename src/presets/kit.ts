import type { SynthPreset } from '../model/types';

// docs/TRD.md → PRESETS → Synth kit. Starting values; tune by ear. Consumed by audio/voices.ts.

export type KitRecipe =
  | { type: 'membrane'; note: string; pitchDecay: number; octaves: number; envelope: { attack: number; decay: number; sustain: number } }
  | { type: 'snare'; noiseDecay: number; toneHz: number; toneDecay: number }
  | { type: 'clap'; noiseDecay: number; bandpassHz: number; repeatsMs: number[] }
  | { type: 'metal'; frequency: number; decay: number; harmonicity: number; resonance: number }
  | { type: 'tone'; hz: number; decay: number };

export interface KitPreset {
  id: SynthPreset;
  label: string;
  midiNote: number; // MIDI export note
  recipe: KitRecipe;
}

export const KIT: Record<SynthPreset, KitPreset> = {
  kick: {
    id: 'kick', label: 'Kick', midiNote: 36,
    recipe: { type: 'membrane', note: 'C1', pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } },
  },
  snare: { id: 'snare', label: 'Snare', midiNote: 38, recipe: { type: 'snare', noiseDecay: 0.15, toneHz: 180, toneDecay: 0.08 } },
  clap: { id: 'clap', label: 'Clap', midiNote: 39, recipe: { type: 'clap', noiseDecay: 0.12, bandpassHz: 1200, repeatsMs: [0, 10, 20] } },
  chh: { id: 'chh', label: 'Closed Hat', midiNote: 42, recipe: { type: 'metal', frequency: 400, decay: 0.05, harmonicity: 5.1, resonance: 4000 } },
  ohh: { id: 'ohh', label: 'Open Hat', midiNote: 46, recipe: { type: 'metal', frequency: 400, decay: 0.4, harmonicity: 5.1, resonance: 4000 } },
  tom: {
    id: 'tom', label: 'Tom', midiNote: 45,
    recipe: { type: 'membrane', note: 'G2', pitchDecay: 0.03, octaves: 2, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } },
  },
  rim: { id: 'rim', label: 'Rim', midiNote: 37, recipe: { type: 'tone', hz: 900, decay: 0.03 } },
  crash: { id: 'crash', label: 'Crash', midiNote: 49, recipe: { type: 'metal', frequency: 300, decay: 1.5, harmonicity: 5.1, resonance: 4000 } },
};

export const KIT_ORDER: SynthPreset[] = ['kick', 'snare', 'clap', 'chh', 'ohh', 'tom', 'rim', 'crash'];
