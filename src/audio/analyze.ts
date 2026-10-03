// docs/TRD.md → SOUND ANALYSIS. Pure-ish buffer processing; works on AudioBuffer-like objects for tests.

export type SoundKind = 'ONE_SHOT' | 'LOOP';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const UPLOAD_MIME = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/ogg'] as const;

/** Minimal AudioBuffer surface used here (lets tests use plain objects). */
export interface BufferLike {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

type MakeBuffer = (channels: number, length: number, sampleRate: number) => BufferLike;

const defaultMake: MakeBuffer = (channels, length, sampleRate) => new AudioBuffer({ numberOfChannels: channels, length: Math.max(1, length), sampleRate });

export async function decode(data: ArrayBuffer, ctx?: BaseAudioContext): Promise<AudioBuffer> {
  const c = ctx ?? new OfflineAudioContext(1, 1, 44100);
  return c.decodeAudioData(data.slice(0));
}

export function durationMs(buf: Pick<BufferLike, 'length' | 'sampleRate'>): number {
  return Math.round((buf.length / buf.sampleRate) * 1000);
}

export function suggestKind(ms: number): SoundKind {
  return ms <= 2000 ? 'ONE_SHOT' : 'LOOP';
}

function peakAbs(buf: BufferLike): number {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Peak-normalize to −1 dBFS (silent buffers are returned unchanged). */
export function normalize<T extends BufferLike>(buf: T): T {
  const peak = peakAbs(buf);
  if (peak === 0) return buf;
  const g = dbToGain(-1) / peak;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  return buf;
}

/** Trim below −45 dBFS (2 ms pre-roll), 5 ms fade-in, 20 ms fade-out, normalize to −1 dBFS. */
export function prepareOneShot(buf: BufferLike, make: MakeBuffer = defaultMake): BufferLike {
  const thr = dbToGain(-45);
  let first = -1;
  let last = -1;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < buf.numberOfChannels; c++) {
      if (Math.abs(buf.getChannelData(c)[i]) >= thr) {
        if (first < 0) first = i;
        last = i;
        break;
      }
    }
  }
  if (first < 0) return buf; // all silence
  const pre = Math.round(0.002 * buf.sampleRate);
  const start = Math.max(0, first - pre);
  const end = last + 1;
  const out = make(buf.numberOfChannels, end - start, buf.sampleRate);
  const fadeIn = Math.min(out.length, Math.round(0.005 * buf.sampleRate));
  const fadeOut = Math.min(out.length, Math.round(0.02 * buf.sampleRate));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < out.length; i++) {
      let v = src[start + i];
      if (i < fadeIn) v *= i / fadeIn;
      const fromEnd = out.length - 1 - i;
      if (fromEnd < fadeOut) v *= fromEnd / fadeOut;
      dst[i] = v;
    }
  }
  return normalize(out);
}

export function prepareLoop<T extends BufferLike>(buf: T): T {
  return normalize(buf);
}

/** Max abs per bucket (mixed across channels), for waveform canvases. */
export function peaks(buf: BufferLike, buckets = 200): number[] {
  const out = new Array<number>(buckets).fill(0);
  const per = buf.length / buckets;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const b = Math.min(buckets - 1, Math.floor(i / per));
      const a = Math.abs(d[i]);
      if (a > out[b]) out[b] = a;
    }
  }
  return out;
}

export function validateUpload(file: { type: string; size: number; name: string }): string | null {
  const type = file.type || guessMime(file.name);
  if (!(UPLOAD_MIME as readonly string[]).includes(type)) return 'Use a WAV, MP3 or OGG file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File is larger than 3 MB.';
  return null;
}

export function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop();
  return ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : '';
}

/** Canonical mime stored on the server: audio/wav | audio/mpeg | audio/ogg. */
export function canonicalMime(type: string): 'audio/wav' | 'audio/mpeg' | 'audio/ogg' | null {
  if (['audio/wav', 'audio/x-wav', 'audio/wave'].includes(type)) return 'audio/wav';
  if (['audio/mpeg', 'audio/mp3'].includes(type)) return 'audio/mpeg';
  if (type === 'audio/ogg') return 'audio/ogg';
  return null;
}
