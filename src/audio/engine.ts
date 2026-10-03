import * as Tone from 'tone';
import type { Channel, Id, Master, Slot, SynthPreset, Workspace } from '../model/types';
import { channelIds, channelOf, isChannelSilenced } from '../store/selectors';
import { SampleVoice, SynthVoice, type Voice } from './voices';

// docs/TRD.md → AUDIO ENGINE. createEngine(context) works with the live context and an offline context (export).
//
// voice → Velocity Gain → EQ3 → Volume → Mute gate → Panner → Meter
//                                         Panner → Master bus
//                                         Panner → Send Gain → Reverb → Reverb return → Master bus
// Master bus → EQ3 → Compressor → Limiter → Volume → Meter → Destination

const RAMP = 0.02;

interface Strip {
  input: Tone.Gain;
  eq: Tone.EQ3;
  volume: Tone.Volume;
  /** Mute/solo gate (gain 0/1, 10 ms ramp). Separate from Volume so fader moves never undo a mute. */
  gate: Tone.Gain;
  panner: Tone.Panner;
  meter: Tone.Meter;
  send: Tone.Gain;
}

interface SlotEntry {
  strip: Strip;
  voice: Voice;
  soundKey: string; // 'synth:kick' | 'sample:<id>'
  tune: number;
}

export interface Engine {
  context: Tone.BaseContext;
  /** Resolves when the reverb impulse response is generated. */
  ready: Promise<void>;
  ensureSlot(slot: Slot): void;
  removeSlot(id: Id): void;
  ensureAudioLane(id: Id): void;
  removeAudioLane(id: Id): void;
  /** Input node of a Channel (Slot or AUDIO lane), for audio clip players. */
  channelInput(id: Id): Tone.InputNode | null;
  setSampleBuffer(slotId: Id, buffer: AudioBuffer | null): void;
  applyChannel(id: Id, channel: Channel, silenced: boolean): void;
  applyMaster(master: Master): void;
  /** Syncs Slots, AUDIO lanes, Channels (incl. solo logic) and Master with the Workspace. */
  sync(w: Workspace): void;
  trigger(slotId: Id, time: number, velocity: number): void;
  preview(slotId: Id): void;
  click(time: number, accent: boolean): void;
  /** Sound Browser preview: plays a buffer straight into the Master bus (max 8 s). Returns a stop function. */
  previewBuffer(buffer: AudioBuffer): () => void;
  /** Sound Browser preview of a synth kit preset. */
  previewPreset(preset: SynthPreset): void;
  /** Plays a LOOP buffer on an AUDIO lane's Channel, looping to fill `durationSec`. */
  playAudio(laneId: Id, buffer: AudioBuffer, time: number, offsetSec: number, durationSec: number, gainDb: number): void;
  stopAudio(time?: number): void;
  meters(): Record<Id | 'master', number>;
  /** Level in dB of one Channel (Slot or AUDIO lane) or 'master' / 'reverb'. */
  meterOf(id: Id | 'master' | 'reverb'): number;
  /** Master [left, right] in dB. */
  masterLevels(): [number, number];
  gainReduction(): number;
  dispose(): void;
}

function setIfChanged(param: Tone.Param<'decibels'> | Tone.Param<'positive'> | Tone.Param<'time'>, value: number) {
  if (Math.abs((param.value as number) - value) > 1e-6) param.value = value;
}

const soundKey = (slot: Slot) => (slot.sound.kind === 'synth' ? `synth:${slot.sound.preset}` : `sample:${slot.sound.soundId}`);

export function createEngine(context: Tone.BaseContext): Engine {
  // Master chain
  const masterBus = new Tone.Gain({ context });
  const masterEq = new Tone.EQ3({ context });
  const compressor = new Tone.Compressor({ context });
  const limiter = new Tone.Limiter({ context, threshold: -1 });
  const masterVol = new Tone.Volume({ context });
  const masterMeter = new Tone.Meter({ context, smoothing: 0.8, channelCount: 2 });
  masterBus.chain(masterEq, compressor, limiter, masterVol, masterMeter);
  masterVol.connect(context.destination);

  // Reverb return
  const reverb = new Tone.Reverb({ context, decay: 2.5, wet: 1 });
  const reverbReturn = new Tone.Volume({ context, volume: -6 });
  const reverbMeter = new Tone.Meter({ context, smoothing: 0.8 });
  reverb.chain(reverbReturn, masterBus);
  reverbReturn.connect(reverbMeter);
  let reverbDecay = 2.5;

  // Metronome: straight to master volume (bypasses mixer)
  const metro = new Tone.Synth({ context, oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } });
  metro.volume.value = -14;
  metro.connect(masterVol);

  const slots = new Map<Id, SlotEntry>();
  const lanes = new Map<Id, Strip>();
  const audioSources = new Set<{ src: Tone.ToneBufferSource; gain: Tone.Gain }>();
  const previewGain = new Tone.Gain({ context, gain: 0.9 }).connect(masterBus);
  const previewVoices = new Map<SynthPreset, SynthVoice>();

  function makeStrip(): Strip {
    const input = new Tone.Gain({ context });
    const eq = new Tone.EQ3({ context });
    const volume = new Tone.Volume({ context });
    const gate = new Tone.Gain({ context, gain: 1 });
    const panner = new Tone.Panner({ context });
    const meter = new Tone.Meter({ context, smoothing: 0.8 });
    const send = new Tone.Gain({ context, gain: 0 });
    input.chain(eq, volume, gate, panner);
    panner.connect(meter);
    panner.connect(masterBus);
    panner.connect(send);
    send.connect(reverb);
    return { input, eq, volume, gate, panner, meter, send };
  }

  function disposeStrip(s: Strip) {
    [s.input, s.eq, s.volume, s.gate, s.panner, s.meter, s.send].forEach((n) => n.dispose());
  }

  function makeVoice(slot: Slot, strip: Strip): Voice {
    return slot.sound.kind === 'synth' ? new SynthVoice(context, slot.sound.preset, strip.input) : new SampleVoice(context, strip.input);
  }

  const engine: Engine = {
    context,
    ready: reverb.ready,

    ensureSlot(slot) {
      const key = soundKey(slot);
      const cur = slots.get(slot.id);
      if (!cur) {
        const strip = makeStrip();
        slots.set(slot.id, { strip, voice: makeVoice(slot, strip), soundKey: key, tune: slot.tune });
        return;
      }
      cur.tune = slot.tune;
      if (cur.soundKey !== key) {
        cur.voice.dispose();
        cur.voice = makeVoice(slot, cur.strip);
        cur.soundKey = key;
      }
    },

    removeSlot(id) {
      const cur = slots.get(id);
      if (!cur) return;
      cur.voice.dispose();
      disposeStrip(cur.strip);
      slots.delete(id);
    },

    ensureAudioLane(id) {
      if (!lanes.has(id)) lanes.set(id, makeStrip());
    },

    removeAudioLane(id) {
      const s = lanes.get(id);
      if (!s) return;
      disposeStrip(s);
      lanes.delete(id);
    },

    channelInput(id) {
      return slots.get(id)?.strip.input ?? lanes.get(id)?.input ?? null;
    },

    setSampleBuffer(slotId, buffer) {
      const v = slots.get(slotId)?.voice;
      if (v instanceof SampleVoice) v.setBuffer(buffer);
    },

    applyChannel(id, ch, silenced) {
      const s = slots.get(id)?.strip ?? lanes.get(id);
      if (!s) return;
      s.volume.volume.rampTo(ch.volumeDb, RAMP);
      s.gate.gain.linearRampTo(silenced ? 0 : 1, 0.01);
      s.panner.pan.rampTo(ch.pan, RAMP);
      s.eq.low.rampTo(ch.eq.low, RAMP);
      s.eq.mid.rampTo(ch.eq.mid, RAMP);
      s.eq.high.rampTo(ch.eq.high, RAMP);
      s.send.gain.rampTo(ch.reverbSend, RAMP);
    },

    applyMaster(m) {
      masterVol.volume.rampTo(m.volumeDb, RAMP);
      masterEq.low.rampTo(m.eq.low, RAMP);
      masterEq.mid.rampTo(m.eq.mid, RAMP);
      masterEq.high.rampTo(m.eq.high, RAMP);
      // Disabled compressor: threshold 0, ratio 1. Disabled limiter: threshold 0. No rewiring during playback.
      // Set directly, not ramped: Tone ramps start from 1e-7 when the current value is 0, which is outside the
      // threshold range [-100, 0]. Threshold/ratio jumps do not click.
      setIfChanged(compressor.threshold, m.compressor.enabled ? m.compressor.threshold : 0);
      setIfChanged(compressor.ratio, m.compressor.enabled ? m.compressor.ratio : 1);
      setIfChanged(compressor.attack, m.compressor.attack);
      setIfChanged(compressor.release, m.compressor.release);
      setIfChanged(limiter.threshold, m.limiter.enabled ? m.limiter.ceiling : 0);
      reverbReturn.volume.rampTo(m.reverb.returnDb, RAMP);
      if (m.reverb.decay !== reverbDecay) {
        reverbDecay = m.reverb.decay;
        reverb.decay = m.reverb.decay; // regenerates the IR asynchronously
      }
    },

    sync(w) {
      const slotIds = new Set(w.rack.map((s) => s.id));
      for (const id of [...slots.keys()]) if (!slotIds.has(id)) engine.removeSlot(id);
      for (const slot of w.rack) engine.ensureSlot(slot);
      const laneIds = new Set(w.lanes.filter((l) => l.type === 'AUDIO').map((l) => l.id));
      for (const id of [...lanes.keys()]) if (!laneIds.has(id)) engine.removeAudioLane(id);
      for (const id of laneIds) engine.ensureAudioLane(id);
      for (const id of channelIds(w)) engine.applyChannel(id, channelOf(w, id), isChannelSilenced(w, id));
      engine.applyMaster(w.mixer.master);
    },

    trigger(slotId, time, velocity) {
      const e = slots.get(slotId);
      if (e) e.voice.trigger(time, velocity, e.tune);
    },

    preview(slotId) {
      engine.trigger(slotId, context.now() + 0.01, 100);
    },

    click(time, accent) {
      try {
        metro.triggerAttackRelease(accent ? 1760 : 880, 0.02, time, accent ? 1 : 0.6);
      } catch {
        /* overlapping click; skip */
      }
    },

    previewBuffer(buffer) {
      const src = new Tone.ToneBufferSource({ context, url: buffer, fadeOut: 0.02 }).connect(previewGain);
      src.onended = () => setTimeout(() => src.dispose(), 0);
      const now = context.now() + 0.01;
      src.start(now);
      src.stop(now + Math.min(8, buffer.duration));
      return () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      };
    },

    previewPreset(preset) {
      let v = previewVoices.get(preset);
      if (!v) {
        v = new SynthVoice(context, preset, previewGain);
        previewVoices.set(preset, v);
      }
      v.trigger(context.now() + 0.01, 100, 0);
    },

    playAudio(laneId, buffer, time, offsetSec, durationSec, gainDb) {
      const strip = lanes.get(laneId);
      if (!strip || durationSec <= 0) return;
      const gain = new Tone.Gain({ context, gain: Tone.dbToGain(gainDb) }).connect(strip.input);
      const src = new Tone.ToneBufferSource({ context, url: buffer, loop: true, fadeIn: 0.003, fadeOut: 0.01 }).connect(gain);
      const entry = { src, gain };
      audioSources.add(entry);
      src.onended = () => {
        audioSources.delete(entry);
        setTimeout(() => {
          src.dispose();
          gain.dispose();
        }, 0);
      };
      src.start(time, offsetSec % buffer.duration);
      src.stop(time + durationSec);
    },

    stopAudio(time) {
      const at = time ?? context.now();
      audioSources.forEach(({ src }) => {
        try {
          src.stop(at);
        } catch {
          /* already stopped */
        }
      });
    },

    meterOf(id) {
      if (id === 'master') return Math.max(...engine.masterLevels());
      if (id === 'reverb') return reverbMeter.getValue() as number;
      const m = slots.get(id)?.strip.meter ?? lanes.get(id)?.meter;
      return m ? (m.getValue() as number) : -Infinity;
    },

    masterLevels() {
      const v = masterMeter.getValue();
      return Array.isArray(v) ? [v[0], v[1]] : [v, v];
    },

    meters() {
      const out: Record<string, number> = { master: Math.max(...engine.masterLevels()) };
      slots.forEach((e, id) => (out[id] = e.strip.meter.getValue() as number));
      lanes.forEach((s, id) => (out[id] = s.meter.getValue() as number));
      return out;
    },

    gainReduction() {
      return compressor.reduction;
    },

    dispose() {
      audioSources.forEach(({ src, gain }) => {
        src.dispose();
        gain.dispose();
      });
      audioSources.clear();
      previewVoices.forEach((v) => v.dispose());
      previewGain.dispose();
      slots.forEach((_, id) => engine.removeSlot(id));
      lanes.forEach((_, id) => engine.removeAudioLane(id));
      [masterBus, masterEq, compressor, limiter, masterVol, masterMeter, reverb, reverbReturn, reverbMeter, metro].forEach((n) => n.dispose());
    },
  };
  return engine;
}
