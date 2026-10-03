import * as Tone from 'tone';
import type { SynthPreset } from '../model/types';
import { KIT } from '../presets/kit';

// docs/TRD.md → Voices. Every voice connects into a Slot's Channel input (the "Velocity Gain" stage).

type Ctx = Tone.BaseContext;

export interface Voice {
  trigger(time: number, velocity: number, tune: number): void;
  dispose(): void;
}

const semis = (tune: number) => Math.pow(2, tune / 12);

/** Monophonic Tone synths need strictly increasing start times; nudge if a humanized hit lands earlier. */
function monotonic() {
  let last = -1;
  return (time: number) => {
    const t = time <= last ? last + 0.0005 : time;
    last = t;
    return t;
  };
}

export class SynthVoice implements Voice {
  private nodes: Tone.ToneAudioNode[] = [];
  private fire: (time: number, vel: number, tune: number) => void;

  constructor(context: Ctx, preset: SynthPreset, out: Tone.InputNode) {
    const r = KIT[preset].recipe;
    const next = monotonic();
    switch (r.type) {
      case 'membrane': {
        const s = new Tone.MembraneSynth({ context, pitchDecay: r.pitchDecay, octaves: r.octaves, envelope: { ...r.envelope, release: 0.05 } }).connect(out);
        this.nodes.push(s);
        const base = Tone.Frequency(r.note).toFrequency();
        this.fire = (t, v, tune) => s.triggerAttackRelease(base * semis(tune), '16n', next(t), v);
        break;
      }
      case 'snare': {
        const noise = new Tone.NoiseSynth({ context, noise: { type: 'white' }, envelope: { attack: 0.001, decay: r.noiseDecay, sustain: 0, release: 0.02 } }).connect(out);
        const body = new Tone.Synth({ context, oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: r.toneDecay, sustain: 0, release: 0.02 } }).connect(out);
        this.nodes.push(noise, body);
        const nextBody = monotonic();
        this.fire = (t, v, tune) => {
          noise.triggerAttackRelease(r.noiseDecay, next(t), v);
          body.triggerAttackRelease(r.toneHz * semis(tune), r.toneDecay, nextBody(t), v);
        };
        break;
      }
      case 'clap': {
        const filter = new Tone.Filter({ context, type: 'bandpass', frequency: r.bandpassHz, Q: 1.2 }).connect(out);
        const noise = new Tone.NoiseSynth({ context, noise: { type: 'pink' }, envelope: { attack: 0.001, decay: r.noiseDecay, sustain: 0, release: 0.02 } }).connect(filter);
        this.nodes.push(filter, noise);
        this.fire = (t, v, tune) => {
          filter.frequency.setValueAtTime(r.bandpassHz * semis(tune), t);
          for (const ms of r.repeatsMs) noise.triggerAttackRelease(0.02, next(t + ms / 1000), ms === r.repeatsMs[r.repeatsMs.length - 1] ? v : v * 0.7);
        };
        break;
      }
      case 'metal': {
        const s = new Tone.MetalSynth({
          context, harmonicity: r.harmonicity, resonance: r.resonance, modulationIndex: 32, octaves: 1.5,
          envelope: { attack: 0.001, decay: r.decay, release: 0.01 },
        }).connect(out);
        s.volume.value = -12; // MetalSynth is much louder than the other voices
        this.nodes.push(s);
        this.fire = (t, v, tune) => s.triggerAttackRelease(r.frequency * semis(tune), r.decay, next(t), v);
        break;
      }
      case 'tone': {
        const s = new Tone.Synth({ context, oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: r.decay, sustain: 0, release: 0.01 } }).connect(out);
        this.nodes.push(s);
        this.fire = (t, v, tune) => s.triggerAttackRelease(r.hz * semis(tune), r.decay, next(t), v);
        break;
      }
    }
  }

  trigger(time: number, velocity: number, tune: number) {
    try {
      this.fire(time, Math.max(0, Math.min(1, velocity / 127)), tune);
    } catch (err) {
      console.warn('voice trigger skipped', err);
    }
  }

  dispose() {
    this.nodes.forEach((n) => n.dispose());
    this.nodes = [];
  }
}

/** Sample voice: one ToneBufferSource per hit so hits can overlap. Silent until a buffer is set. */
export class SampleVoice implements Voice {
  private buffer: AudioBuffer | null = null;
  private live = new Set<Tone.ToneBufferSource>();

  constructor(private context: Ctx, private out: Tone.InputNode) {}

  setBuffer(buffer: AudioBuffer | null) {
    this.buffer = buffer;
  }

  trigger(time: number, velocity: number, tune: number) {
    if (!this.buffer) return;
    const gain = new Tone.Gain({ context: this.context, gain: Math.max(0, Math.min(1, velocity / 127)) }).connect(this.out);
    const src = new Tone.ToneBufferSource({ context: this.context, url: this.buffer, playbackRate: semis(tune) }).connect(gain);
    src.onended = () => {
      this.live.delete(src);
      // Defer disposal: onended can fire inside the source's own callback.
      setTimeout(() => {
        src.dispose();
        gain.dispose();
      }, 0);
    };
    this.live.add(src);
    src.start(time);
  }

  dispose() {
    this.live.forEach((s) => s.dispose());
    this.live.clear();
  }
}
