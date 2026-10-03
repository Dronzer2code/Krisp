import type { MusicRNN } from '@magenta/music/esm/music_rnn';
import type { MusicVAE } from '@magenta/music/esm/music_vae';

// docs/TRD.md → AI INTEGRATION. Magenta loads lazily on first AI use; models are cached.
// VERIFY-1: ESM submodule imports work under Vite. UMD fallback kept for safety (global `mm`).

export const CHECKPOINT_BASE = 'https://storage.googleapis.com/magentadata/js/checkpoints/';
export const CHECKPOINTS = {
  vae: 'music_vae/drums_2bar_lokl_small', // Variations, Morph
  groove: 'music_vae/groovae_2bar_humanize', // Humanize
  rnn: 'music_rnn/drum_kit_rnn', // Continue
} as const;
export type ModelKey = keyof typeof CHECKPOINTS;
export type ModelStatus = 'NotLoaded' | 'Loading' | 'Ready' | 'Failed';

const UMD_URL = 'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/dist/magentamusic.js';

interface MagentaLib {
  MusicVAE: typeof MusicVAE;
  MusicRNN: typeof MusicRNN;
  source: 'esm' | 'umd';
}

let libPromise: Promise<MagentaLib> | null = null;

function loadUmd(): Promise<MagentaLib> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = UMD_URL;
    el.async = true;
    el.onload = () => {
      const mm = (window as unknown as { mm?: { MusicVAE: typeof MusicVAE; MusicRNN: typeof MusicRNN } }).mm;
      if (mm) resolve({ MusicVAE: mm.MusicVAE, MusicRNN: mm.MusicRNN, source: 'umd' });
      else reject(new Error('magenta_umd_missing_global'));
    };
    el.onerror = () => reject(new Error('magenta_umd_load_failed'));
    document.head.appendChild(el);
  });
}

export function loadMagenta(): Promise<MagentaLib> {
  if (!libPromise) {
    libPromise = Promise.all([import('@magenta/music/esm/music_vae'), import('@magenta/music/esm/music_rnn')])
      .then(([vae, rnn]): MagentaLib => ({ MusicVAE: vae.MusicVAE, MusicRNN: rnn.MusicRNN, source: 'esm' }))
      .catch((err) => {
        console.warn('Magenta ESM import failed, falling back to UMD', err);
        return loadUmd();
      })
      .catch((err) => {
        libPromise = null; // allow retry
        throw err;
      });
  }
  return libPromise;
}

// ── Model cache + status (AI model state machine: docs/PROCESS_FLOW.md) ──

type ModelInstance = { vae: MusicVAE; groove: MusicVAE; rnn: MusicRNN };
const models: Partial<ModelInstance> = {};
const pending: Partial<Record<ModelKey, Promise<unknown>>> = {};
const statuses: Record<ModelKey, ModelStatus> = { vae: 'NotLoaded', groove: 'NotLoaded', rnn: 'NotLoaded' };
const listeners = new Set<() => void>();

function setStatus(key: ModelKey, status: ModelStatus) {
  statuses[key] = status;
  listeners.forEach((cb) => cb());
}

export function getModelStatus(key: ModelKey): ModelStatus {
  return statuses[key];
}

export function subscribeModelStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getModel<K extends ModelKey>(key: K): Promise<ModelInstance[K]> {
  const cached = models[key];
  if (cached) return Promise.resolve(cached as ModelInstance[K]);
  if (!pending[key]) {
    setStatus(key, 'Loading');
    pending[key] = (async () => {
      const lib = await loadMagenta();
      const url = CHECKPOINT_BASE + CHECKPOINTS[key];
      const model = key === 'rnn' ? new lib.MusicRNN(url) : new lib.MusicVAE(url);
      await model.initialize();
      (models as Record<ModelKey, unknown>)[key] = model;
      setStatus(key, 'Ready');
      return model;
    })().catch((err) => {
      delete pending[key];
      setStatus(key, 'Failed');
      throw err;
    });
  }
  return pending[key] as Promise<ModelInstance[K]>;
}
