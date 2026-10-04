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

/** Overlapping hits per sample Slot. A long one-shot on every 16th would otherwise stack ~14 copies per Slot
 * and overload the audio thread (crackles in long loops); the oldest is faded out instead. */
export const SAMPLE_POLYPHONY = 4;

/** Sample voice: one ToneBufferSource per hit so hits can overlap (up to SAMPLE_POLYPHONY). Silent until a buffer is set. */
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
    while (this.live.size >= SAMPLE_POLYPHONY) {
      const oldest = this.live.values().next().value as Tone.ToneBufferSource;
      this.live.delete(oldest);
      try {
        oldest.stop(time); // fadeOut avoids a click
      } catch {
        /* already stopped */
      }
    }
    const src = new Tone.ToneBufferSource({ context: this.context, url: this.buffer, playbackRate: semis(tune), fadeOut: 0.008 }).connect(gain);
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

/**
 * Live-only voice for MetalSynth presets (hats, crash). A MetalSynth hit builds ~12 oscillators and ~30 connects
 * in JS, which on a full grid kept the main thread busy enough to make loops stutter. The preset is rendered
 * once per (tune, velocity level) into a buffer (offline, off the live context) and each hit plays that buffer:
 * the synth is deterministic, so the sound is identical, for 2 nodes per hit. Velocity also moves the synth's
 * high-pass filter (timbre), so it is baked too: the pad levels exactly, other velocities to the nearest 8
 * with the small level rest applied as gain. Monophonic like the synth: a new hit chokes the previous one.
 * Until a buffer is ready, hits fall back to the live synth.
 */
export function bakeLevel(velocity: number): number {
  const v = Math.max(1, Math.min(127, Math.round(velocity)));
  if (v === 40 || v === 80 || v === 100 || v === 127) return v; // pad velocity levels: exact
  return Math.max(8, Math.min(127, Math.round(v / 8) * 8));
}

// Bakes run one per task so warming up (3 presets × 4 levels) never blocks the main thread in one long task.
const bakeQueue: (() => void)[] = [];
function enqueueBake(job: () => void) {
  bakeQueue.push(job);
  if (bakeQueue.length === 1) setTimeout(runBakeQueue, 0);
}
function runBakeQueue() {
  try {
    bakeQueue[0]?.();
  } catch (err) {
    console.warn('bake skipped', err);
  } finally {
    bakeQueue.shift();
    if (bakeQueue.length) setTimeout(runBakeQueue, 0);
  }
}

export class BakedMetalVoice implements Voice {
  private baked = new Map<string, AudioBuffer | 'pending'>(); // key `${tune}:${level}`
  private fallback: SynthVoice | null = null; // built only if a hit arrives before its buffer is ready
  private last: Tone.ToneBufferSource | null = null;
  private live = new Set<{ src: Tone.ToneBufferSource; gain: Tone.Gain }>();
  private disposed = false;

  constructor(private context: Ctx, private preset: SynthPreset, private out: Tone.InputNode) {
    for (const level of [127, 100, 80, 40]) this.bake(0, level);
  }

  private bake(tune: number, level: number) {
    const key = `${tune}:${level}`;
    if (this.baked.has(key)) return;
    const r = KIT[this.preset].recipe;
    if (r.type !== 'metal') return;
    this.baked.set(key, 'pending');
    enqueueBake(() => this.render(tune, level, key));
  }

  private render(tune: number, level: number, key: string) {
    const r = KIT[this.preset].recipe;
    if (this.disposed || r.type !== 'metal') {
      this.baked.delete(key);
      return;
    }
    const offline = new Tone.OfflineContext(1, r.decay + 0.15, this.context.sampleRate);
    const voice = new SynthVoice(offline, this.preset, offline.destination);
    voice.trigger(0, level, tune);
    offline
      .render()
      .then((buf) => {
        const b = buf.get();
        if (b && !this.disposed) this.baked.set(key, b);
        else this.baked.delete(key);
      })
      .catch(() => this.baked.delete(key))
      .finally(() => {
        voice.dispose();
        void offline.dispose();
      });
  }

  trigger(time: number, velocity: number, tune: number) {
    const level = bakeLevel(velocity);
    const buffer = this.baked.get(`${tune}:${level}`);
    if (!(buffer instanceof AudioBuffer)) {
      this.bake(tune, level);
      this.fallback ??= new SynthVoice(this.context, this.preset, this.out);
      this.fallback.trigger(time, velocity, tune);
      return;
    }
    try {
      this.last?.stop(time);
    } catch {
      /* already stopped */
    }
    const gain = new Tone.Gain({ context: this.context, gain: Math.max(0, velocity) / level }).connect(this.out);
    const src = new Tone.ToneBufferSource({ context: this.context, url: buffer, fadeOut: 0.005 }).connect(gain);
    const entry = { src, gain };
    this.live.add(entry);
    src.onended = () => {
      this.live.delete(entry);
      if (this.last === src) this.last = null;
      setTimeout(() => {
        src.dispose();
        gain.dispose();
      }, 0);
    };
    src.start(time);
    this.last = src;
  }

  dispose() {
    this.disposed = true;
    this.fallback?.dispose();
    this.live.forEach(({ src, gain }) => {
      src.dispose();
      gain.dispose();
    });
    this.live.clear();
  }
}
