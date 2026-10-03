import type { SoundKind } from '../audio/analyze';
import { apiJson } from './client';

export interface SoundMeta {
  id: string;
  name: string;
  kind: SoundKind;
  source: 'ELEVENLABS' | 'UPLOAD';
  prompt: string | null;
  tags: string[];
  duration_ms: number;
  created_at: string;
}

export interface SearchResult extends SoundMeta {
  score: number;
  vector_hit: boolean;
  keyword_hit: boolean;
}

export async function listSounds(kind?: SoundKind, limit = 100): Promise<SoundMeta[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (kind) q.set('kind', kind);
  return (await apiJson<{ sounds: SoundMeta[] }>(`/api/sounds?${q}`)).sounds;
}

export async function uploadSound(body: { name: string; kind: SoundKind; tags: string[]; mime: string; durationMs: number; audioBase64: string; embedding: number[] }): Promise<SoundMeta> {
  return (await apiJson<{ sound: SoundMeta }>('/api/sounds', { method: 'POST', body: JSON.stringify(body) })).sound;
}

export async function generateSound(body: { prompt: string; kind: SoundKind; durationSeconds: number; name: string; tags: string[]; embedding: number[] }) {
  return apiJson<{ sound: SoundMeta; remainingToday: number }>('/api/sound-generate', { method: 'POST', body: JSON.stringify(body) });
}

export async function remainingGenerations(): Promise<{ remainingToday: number; limit: number }> {
  return apiJson('/api/sound-generate');
}

export async function searchSounds(q: string, embedding: number[], kind?: SoundKind): Promise<SearchResult[]> {
  return (await apiJson<{ results: SearchResult[] }>('/api/search', { method: 'POST', body: JSON.stringify({ q, embedding, kind }) })).results;
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** Shapes the prompt sent to ElevenLabs (docs/TRD.md); the UI shows it under the field. */
export function shapePrompt(text: string, kind: SoundKind, bpm: number): string {
  const t = text.trim();
  return kind === 'ONE_SHOT' ? `${t}, single drum one-shot, isolated, dry, no music` : `${t}, seamless drum loop, ${Math.round(bpm)} bpm`;
}

const STOP = new Set(['a', 'an', 'the', 'and', 'with', 'of', 'for', 'in', 'on', 'very', 'bit', 'some', 'short', 'long']);

/** Name and tags pre-filled from a description (J4 step 2). */
export function suggestNameAndTags(text: string): { name: string; tags: string[] } {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const tags = [...new Set(words.filter((w) => !STOP.has(w) && w.length > 1))].slice(0, 6);
  const name = text.split(',')[0].trim().slice(0, 40) || 'New sound';
  return { name: name.charAt(0).toUpperCase() + name.slice(1), tags };
}
