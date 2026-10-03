import { Midi } from '@tonejs/midi';
import type { Beat, Slot, Workspace } from '../model/types';
import { KIT } from '../presets/kit';
import { rowOf } from '../store/ops';
import { selectedBeat } from '../store/selectors';
import { hitTime, stepSeconds } from './scheduler';
import { safeFileName } from './export-wav';

// docs/TRD.md → EXPORT (MIDI, SHOULD F10). One track, channel 9 (GM drums); notes at hitTime positions
// (swing + offset); velocity v/127; one 16th long; header tempo = BPM.

export type MidiScope = 'beat' | 'song';

export interface MidiHit {
  midi: number;
  time: number;
  velocity: number;
}

export function midiNoteFor(slot: Slot): number {
  return slot.sound.kind === 'synth' ? KIT[slot.sound.preset].midiNote : slot.pitch;
}

function beatHits(w: Workspace, beat: Beat, startStep: number, steps: number, out: MidiHit[]) {
  const sec = stepSeconds(w.bpm);
  for (let k = 0; k < steps; k++) {
    const t = startStep + k;
    const i = k % beat.length;
    for (const slot of w.rack) {
      const st = rowOf(beat, slot.id)[i];
      if (!st?.on) continue;
      out.push({ midi: midiNoteFor(slot), time: Math.max(0, hitTime(t * sec, t % 16, st, w.swing, sec)), velocity: st.velocity / 127 });
    }
  }
}

export function collectHits(w: Workspace, scope: MidiScope): MidiHit[] {
  const out: MidiHit[] = [];
  if (scope === 'beat') {
    const beat = selectedBeat(w);
    if (beat) beatHits(w, beat, 0, beat.length, out);
  } else {
    for (const c of w.clips) {
      if (c.kind !== 'beat') continue;
      const beat = w.beats.find((b) => b.id === c.beatId);
      if (beat) beatHits(w, beat, c.startBar * 16, c.lengthBars * 16, out);
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

export function buildMidi(w: Workspace, scope: MidiScope): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(w.bpm);
  midi.header.name = w.name;
  const track = midi.addTrack();
  track.channel = 9;
  track.name = scope === 'beat' ? selectedBeat(w)?.name ?? 'Beat' : 'Song';
  const dur = stepSeconds(w.bpm);
  for (const h of collectHits(w, scope)) track.addNote({ midi: h.midi, time: h.time, duration: dur, velocity: h.velocity });
  return midi.toArray();
}

export function exportMidi(w: Workspace, scope: MidiScope): { blob: Blob; filename: string } {
  const bytes = buildMidi(w, scope);
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }),
    filename: `${safeFileName(w.name)}-${scope}-${Math.round(w.bpm)}bpm.mid`,
  };
}
