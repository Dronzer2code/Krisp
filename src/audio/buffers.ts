import { useSyncExternalStore } from 'react';
import type { Id } from '../model/types';
import { apiFetch } from '../api/client';
import { decode, prepareLoop, prepareOneShot, type SoundKind } from './analyze';

// Sound id → prepared AudioBuffer cache (docs/TRD.md → Voices, SF5). Fetches /api/sound-audio?id=.

export type BufferStatus = 'loading' | 'ready' | 'error';

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer>>();
const status = new Map<string, BufferStatus>();
const listeners = new Set<() => void>();
let version = 0;

const key = (id: Id, kind: SoundKind) => `${kind}:${id}`;

function emit() {
  version++;
  listeners.forEach((cb) => cb());
}

export function getBuffer(id: Id, kind: SoundKind): AudioBuffer | undefined {
  return buffers.get(key(id, kind));
}

export function getBufferStatus(id: Id, kind: SoundKind): BufferStatus | undefined {
  return status.get(key(id, kind));
}

/** Stores an already-decoded buffer (upload / generate) so it is not downloaded again. */
export function putBuffer(id: Id, kind: SoundKind, decoded: AudioBuffer) {
  const prepared = (kind === 'ONE_SHOT' ? prepareOneShot(decoded) : prepareLoop(decoded)) as AudioBuffer;
  buffers.set(key(id, kind), prepared);
  status.set(key(id, kind), 'ready');
  emit();
  return prepared;
}

export function loadBuffer(id: Id, kind: SoundKind, opts: { retry?: boolean } = {}): Promise<AudioBuffer> {
  const k = key(id, kind);
  const cached = buffers.get(k);
  if (cached) return Promise.resolve(cached);
  if (opts.retry) pending.delete(k);
  const inflight = pending.get(k);
  if (inflight) return inflight;
  status.set(k, 'loading');
  emit();
  const p = (async () => {
    const res = await apiFetch(`/api/sound-audio?id=${encodeURIComponent(id)}`);
    const decoded = await decode(await res.arrayBuffer());
    return putBuffer(id, kind, decoded);
  })().catch((err) => {
    pending.delete(k);
    status.set(k, 'error');
    emit();
    throw err;
  });
  pending.set(k, p);
  return p;
}

export function subscribeBuffers(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-renders when any buffer status changes. */
export function useBufferVersion(): number {
  return useSyncExternalStore(subscribeBuffers, () => version);
}
