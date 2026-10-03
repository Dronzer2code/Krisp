import type * as Tone from 'tone';
import type { BeatClip, Id, Step, Workspace } from '../model/types';
import { rowOf } from '../store/ops';
import { selectedBeat } from '../store/selectors';

// docs/TRD.md → SCHEDULING. Pure timing functions (unit-tested) + one Transport binding.

export const stepSeconds = (bpm: number) => 60 / bpm / 4;
export const barSeconds = (bpm: number) => 16 * stepSeconds(bpm);

/** Every second 16th is delayed by swing · stepSeconds / 2. */
export function swingDelay(stepIndex: number, swing: number, stepSec: number): number {
  return stepIndex % 2 === 1 ? (swing * stepSec) / 2 : 0;
}

/** Hit time for a step: tick time + swing + microtiming offset, clamped ≥ tickTime − 0.4·stepSeconds. */
export function hitTime(tickTime: number, stepIndex: number, step: Pick<Step, 'offset'>, swing: number, stepSec: number): number {
  const t = tickTime + swingDelay(stepIndex, swing, stepSec) + step.offset * stepSec;
  return Math.max(t, tickTime - 0.4 * stepSec);
}

/** Maps a linear 16th count to the loop region when looping in SONG mode. */
export function wrapTick(rawTick: number, loop: Workspace['loop']): number {
  if (!loop.enabled || loop.endBar <= loop.startBar) return rawTick;
  const start = loop.startBar * 16;
  const end = loop.endBar * 16;
  if (rawTick < end) return rawTick;
  return start + ((rawTick - start) % (end - start));
}

export function beatClipAt(w: Workspace, laneId: Id, bar: number): BeatClip | undefined {
  return w.clips.find((c): c is BeatClip => c.kind === 'beat' && c.laneId === laneId && c.startBar <= bar && bar < c.startBar + c.lengthBars);
}

export interface Trigger {
  slotId: Id;
  velocity: number;
  offset: number; // in steps
}

/** All step triggers at global tick t (t already wrapped to the loop region). */
export function triggersAt(w: Workspace, t: number): Trigger[] {
  const out: Trigger[] = [];
  const push = (beat: NonNullable<ReturnType<typeof selectedBeat>>, i: number) => {
    for (const slot of w.rack) {
      const step = rowOf(beat, slot.id)[i];
      if (step?.on) out.push({ slotId: slot.id, velocity: step.velocity, offset: step.offset });
    }
  };
  if (w.playMode === 'BEAT') {
    const beat = selectedBeat(w);
    if (beat) push(beat, t % beat.length);
    return out;
  }
  const bar = Math.floor(t / 16);
  const s = t % 16;
  for (const lane of w.lanes) {
    if (lane.type !== 'BEAT') continue;
    const clip = beatClipAt(w, lane.id, bar);
    if (!clip) continue;
    const beat = w.beats.find((b) => b.id === clip.beatId);
    if (!beat) continue;
    push(beat, ((bar - clip.startBar) * 16 + s) % beat.length);
  }
  return out;
}

export interface AudioStart {
  clipId: Id;
  laneId: Id;
  soundId: Id;
  gainDb: number;
  /** Seconds into the clip where playback begins (non-zero when starting mid-clip). */
  offsetSec: number;
  /** Seconds until the clip ends. */
  durationSec: number;
}

/**
 * Audio clips to start at tick t (SONG mode only). On a jump (play start, seek, loop wrap) every clip
 * spanning t starts mid-clip with an offset; otherwise clips start on their first bar.
 */
export function audioStartsAt(w: Workspace, t: number, jump: boolean): AudioStart[] {
  if (w.playMode !== 'SONG') return [];
  const sec = stepSeconds(w.bpm);
  const out: AudioStart[] = [];
  for (const c of w.clips) {
    if (c.kind !== 'audio') continue;
    const start = c.startBar * 16;
    const end = (c.startBar + c.lengthBars) * 16;
    if (t < start || t >= end) continue;
    if (!jump && t !== start) continue;
    let endTick = end;
    if (w.loop.enabled && w.loop.endBar * 16 > t) endTick = Math.min(end, w.loop.endBar * 16);
    out.push({
      clipId: c.id, laneId: c.laneId, soundId: c.soundId, gainDb: c.gainDb,
      offsetSec: (t - start) * sec,
      durationSec: (endTick - t) * sec,
    });
  }
  return out;
}

/** SONG mode without loop stops at songBars. */
export function isSongEnd(w: Workspace, t: number): boolean {
  return w.playMode === 'SONG' && !w.loop.enabled && t >= w.songBars * 16;
}

/** Beat step index shown in the grid for tick t (selected Beat in BEAT mode; the clip's Beat in SONG mode if it is the selected one). */
export function gridStepAt(w: Workspace, t: number): number {
  const beat = selectedBeat(w);
  if (!beat || t < 0) return -1;
  if (w.playMode === 'BEAT') return t % beat.length;
  const bar = Math.floor(t / 16);
  for (const lane of w.lanes) {
    if (lane.type !== 'BEAT') continue;
    const clip = beatClipAt(w, lane.id, bar);
    if (clip && clip.beatId === beat.id) return ((bar - clip.startBar) * 16 + (t % 16)) % beat.length;
  }
  return -1;
}

// ── Transport binding ──

export interface SchedulerHooks {
  getWorkspace: () => Workspace;
  trigger: (slotId: Id, time: number, velocity: number) => void;
  click?: (time: number, accent: boolean) => void;
  startAudio?: (a: AudioStart, time: number) => void;
  /** Stops all audio clips (called on jumps such as loop wrap). */
  stopAudio?: (time: number) => void;
  /** Called on the audio thread time; use Draw for UI. */
  onTick?: (t: number, time: number) => void;
  onSongEnd?: (time: number) => void;
}

/**
 * Binds the step scheduler to a Transport (live: Tone.getTransport(); offline: context.transport).
 * Returns an unbind function. The Workspace is read on every tick, so edits apply without restarting.
 */
export type Transport = ReturnType<typeof Tone.getTransport>;

export function bindScheduler(transport: Transport, hooks: SchedulerHooks): () => void {
  const ticksPer16th = transport.PPQ / 4;
  let ended = false;
  let prev: number | null = null;
  const id = transport.scheduleRepeat((time) => {
    const w = hooks.getWorkspace();
    // The Transport never loops; the loop region is applied here so beats and audio clips share one path.
    const raw = Math.round(transport.getTicksAtTime(time) / ticksPer16th);
    const t = w.playMode === 'SONG' ? wrapTick(raw, w.loop) : raw;
    if (isSongEnd(w, t)) {
      if (!ended) {
        ended = true;
        hooks.onSongEnd?.(time);
      }
      return;
    }
    const jump = prev === null || t !== prev + 1;
    prev = t;
    if (hooks.startAudio) {
      if (jump && hooks.stopAudio) hooks.stopAudio(time);
      for (const a of audioStartsAt(w, t, jump)) hooks.startAudio(a, time);
    }
    const sec = stepSeconds(w.bpm);
    const swingIndex = t % 16;
    for (const trig of triggersAt(w, t)) {
      hooks.trigger(trig.slotId, hitTime(time, swingIndex, trig, w.swing, sec), trig.velocity);
    }
    if (w.metronome && hooks.click && t % 4 === 0) hooks.click(time, t % 16 === 0);
    hooks.onTick?.(t, time);
  }, '16n', 0);
  return () => {
    transport.clear(id);
  };
}
