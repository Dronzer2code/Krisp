import * as Tone from 'tone';
import type { Id, Workspace } from '../model/types';
import { useWorkspace } from '../store/workspace';
import { withAudition } from './audition';
import { getBuffer, loadBuffer, subscribeBuffers } from './buffers';
import { createEngine, type Engine } from './engine';
import { emitHit, setPlayhead } from './playhead';
import { bindScheduler, gridStepAt, stepSeconds } from './scheduler';

// Live audio: AudioContext starts on the first user gesture (docs/TRD.md → CONSTRAINTS).
// Owns the single live Engine, keeps it in sync with the store, and runs the Transport.

let engine: Engine | null = null;
let starting: Promise<Engine> | null = null;
let unbind: (() => void) | null = null;
let unsubStore: (() => void) | null = null;

export function getEngine(): Engine | null {
  return engine;
}

/** Loads buffers for sample Slots and audio clips (SF5). Playback of a not-yet-loaded Slot is silent. */
export function prefetchBuffers(w: Workspace) {
  for (const slot of w.rack) {
    if (slot.sound.kind === 'sample') loadBuffer(slot.sound.soundId, 'ONE_SHOT').catch(() => {});
  }
  for (const c of w.clips) if (c.kind === 'audio') loadBuffer(c.soundId, 'LOOP').catch(() => {});
}

function attachSampleBuffers(w: Workspace) {
  if (!engine) return;
  for (const slot of w.rack) {
    if (slot.sound.kind === 'sample') engine.setSampleBuffer(slot.id, getBuffer(slot.sound.soundId, 'ONE_SHOT') ?? null);
  }
}

export function ensureAudioStarted(): Promise<Engine> {
  if (engine) return Promise.resolve(engine);
  if (!starting) {
    starting = (async () => {
      await Tone.start();
      Tone.getContext().lookAhead = 0.1;
      const e = createEngine(Tone.getContext());
      engine = e;
      const w = useWorkspace.getState().workspace;
      e.sync(w);
      attachSampleBuffers(w);
      Tone.getTransport().bpm.value = w.bpm;
      unsubStore = useWorkspace.subscribe((s, prev) => {
        if (s.workspace === prev.workspace) return;
        e.sync(s.workspace);
        attachSampleBuffers(s.workspace);
        if (s.workspace.bpm !== prev.workspace.bpm) Tone.getTransport().bpm.value = s.workspace.bpm;
        if (s.workspace.playMode !== prev.workspace.playMode && isPlaying()) void restart();
        if (s.workspace.id !== prev.workspace.id && isPlaying()) stop();
      });
      subscribeBuffers(() => attachSampleBuffers(useWorkspace.getState().workspace));
      return e;
    })().catch((err) => {
      starting = null;
      throw err;
    });
  }
  return starting;
}

export function isPlaying(): boolean {
  return Tone.getTransport().state === 'started';
}

export async function play() {
  const e = await ensureAudioStarted();
  if (isPlaying()) return;
  const transport = Tone.getTransport();
  transport.cancel();
  transport.loop = false;
  transport.position = 0;
  transport.bpm.value = useWorkspace.getState().workspace.bpm;
  unbind?.();
  unbind = bindScheduler(transport, {
    getWorkspace: () => withAudition(useWorkspace.getState().workspace),
    trigger: (slotId, time, velocity) => {
      e.trigger(slotId, time, velocity);
      Tone.getDraw().schedule(() => emitHit(slotId), time);
    },
    click: (time, accent) => e.click(time, accent),
    startAudio: (a, time) => {
      const buf = getBuffer(a.soundId, 'LOOP');
      if (buf) e.playAudio(a.laneId, buf, time, a.offsetSec, a.durationSec, a.gainDb);
      else loadBuffer(a.soundId, 'LOOP').catch(() => {});
    },
    stopAudio: (time) => e.stopAudio(time),
    onTick: (t, time) => {
      Tone.getDraw().schedule(() => {
        const w = useWorkspace.getState().workspace;
        setPlayhead({ tick: t, beatStep: gridStepAt(w, t), seconds: t * stepSeconds(w.bpm) });
      }, time);
    },
    onSongEnd: (time) => Tone.getDraw().schedule(() => stop(), time),
  });
  transport.start('+0.05');
  setPlayhead({ playing: true, tick: -1, beatStep: -1, seconds: 0 });
}

export function stop() {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  unbind?.();
  unbind = null;
  engine?.stopAudio();
  setPlayhead({ playing: false, tick: -1, beatStep: -1, seconds: 0 });
}

export async function togglePlay() {
  if (isPlaying()) stop();
  else await play();
}

/** Return to start: restarts from bar 1 when playing; resets the position when stopped. */
export async function restart() {
  if (isPlaying()) {
    stop();
    await play();
  } else {
    setPlayhead({ tick: -1, beatStep: -1, seconds: 0 });
  }
}

/** Fractional 16th-step position of the Transport right now (null when stopped). Used by live record. */
export function currentStepPosition(): number | null {
  if (!isPlaying()) return null;
  const w = useWorkspace.getState().workspace;
  // Position at the audio clock (what you hear), not now + lookAhead (what is being scheduled).
  return Tone.getTransport().getSecondsAtTime(Tone.getContext().currentTime) / stepSeconds(w.bpm);
}

export async function previewSlot(slotId: Id) {
  const e = await ensureAudioStarted();
  e.preview(slotId);
  emitHit(slotId);
}

/** Test/dev hook: tears down the live engine. */
export function disposeLiveAudio() {
  stop();
  unsubStore?.();
  engine?.dispose();
  engine = null;
  starting = null;
}
