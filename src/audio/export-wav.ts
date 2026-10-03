import * as Tone from 'tone';
import type { Workspace } from '../model/types';
import { getBuffer, loadBuffer } from './buffers';
import { createEngine } from './engine';
import { barSeconds, bindScheduler } from './scheduler';
import { encodeWav } from './wav-encoder';

// docs/TRD.md → EXPORT. Offline render reusing createEngine + the same scheduler code as live playback, so the
// WAV matches what you hear (arrangement, mixer, master). VERIFY-7: Tone.Offline(cb(context), duration,
// channels, sampleRate) → ToneAudioBuffer; the offline context has its own `transport`.

export type WavRange = 'song' | 'loop';
const TAIL_SECONDS = 2;
const SAMPLE_RATE = 44100;

/** Workspace prepared for rendering: SONG mode, no metronome, range shifted to start at bar 0. */
export function exportWorkspace(w: Workspace, range: WavRange): { ws: Workspace; bars: number } {
  const start = range === 'loop' ? w.loop.startBar : 0;
  const bars = range === 'loop' ? Math.max(1, w.loop.endBar - w.loop.startBar) : w.songBars;
  const clips = w.clips
    .filter((c) => c.startBar + c.lengthBars > start && c.startBar < start + bars)
    .map((c) => ({ ...c, startBar: c.startBar - start }));
  return {
    ws: { ...w, playMode: 'SONG', metronome: false, loop: { enabled: false, startBar: 0, endBar: 4 }, songBars: bars, clips },
    bars,
  };
}

/** Loads every buffer the render needs (sample Slots + audio clips) before rendering. */
async function prefetch(w: Workspace) {
  const jobs: Promise<unknown>[] = [];
  for (const s of w.rack) if (s.sound.kind === 'sample') jobs.push(loadBuffer(s.sound.soundId, 'ONE_SHOT'));
  for (const c of w.clips) if (c.kind === 'audio') jobs.push(loadBuffer(c.soundId, 'LOOP'));
  await Promise.all(jobs);
}

export async function renderMix(w: Workspace, range: WavRange): Promise<AudioBuffer> {
  const { ws, bars } = exportWorkspace(w, range);
  await prefetch(ws);
  const seconds = bars * barSeconds(ws.bpm);
  const rendered = await Tone.Offline(
    async (ctx) => {
      const engine = createEngine(ctx);
      engine.sync(ws);
      for (const s of ws.rack) if (s.sound.kind === 'sample') engine.setSampleBuffer(s.id, getBuffer(s.sound.soundId, 'ONE_SHOT') ?? null);
      await engine.ready; // reverb impulse response
      const transport = ctx.transport;
      transport.bpm.value = ws.bpm;
      bindScheduler(transport, {
        getWorkspace: () => ws,
        trigger: (slotId, time, velocity) => engine.trigger(slotId, time, velocity),
        startAudio: (a, time) => {
          const buf = getBuffer(a.soundId, 'LOOP');
          if (buf) engine.playAudio(a.laneId, buf, time, a.offsetSec, a.durationSec, a.gainDb);
        },
        stopAudio: (time) => engine.stopAudio(time),
      });
      transport.start(0);
    },
    seconds + TAIL_SECONDS,
    2,
    SAMPLE_RATE,
  );
  const buf = rendered.get();
  if (!buf) throw new Error('render_failed');
  return buf;
}

export function safeFileName(s: string): string {
  return s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'pocket';
}

export async function exportWav(w: Workspace, range: WavRange): Promise<{ blob: Blob; filename: string; seconds: number }> {
  const buf = await renderMix(w, range);
  const blob = new Blob([encodeWav(buf)], { type: 'audio/wav' });
  return { blob, filename: `${safeFileName(w.name)}-${Math.round(w.bpm)}bpm.wav`, seconds: buf.duration };
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
