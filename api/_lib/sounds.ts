import { query, toVectorLiteral } from './db.js';

// Shared Sound helpers for /api/sounds, /api/sound-generate, /api/search (docs/TRD.md → DATABASE, API CONTRACTS).

export type SoundKind = 'ONE_SHOT' | 'LOOP';
export type SoundSource = 'ELEVENLABS' | 'UPLOAD';

export interface SoundMeta {
  id: string;
  name: string;
  kind: SoundKind;
  source: SoundSource;
  prompt: string | null;
  tags: string[];
  duration_ms: number;
  created_at: string;
}

export const META_COLS = 'id, name, kind, source, prompt, tags, duration_ms, created_at';
export const EMBEDDING_DIM = 384;
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

export function isKind(v: unknown): v is SoundKind {
  return v === 'ONE_SHOT' || v === 'LOOP';
}

export function validEmbedding(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === EMBEDDING_DIM && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().slice(0, 100);
  return n.length ? n : null;
}

export function cleanTags(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 16) return null;
  const out: string[] = [];
  for (const t of v) {
    if (typeof t !== 'string') return null;
    const s = t.trim().toLowerCase().slice(0, 32);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** INSERT a Sound. `tsv` is filled with the same expression the generated column would have used (VERIFY-6 fallback). */
export async function insertSound(s: {
  name: string;
  kind: SoundKind;
  source: SoundSource;
  prompt: string | null;
  tags: string[];
  mime: string;
  durationMs: number;
  audio: Buffer;
  embedding: number[];
}): Promise<SoundMeta> {
  const rows = await query<SoundMeta>(
    `INSERT INTO sounds (name, kind, source, prompt, tags, mime, duration_ms, audio, embedding, tsv)
     VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9::vector,
             to_tsvector('english', coalesce($1,'') || ' ' || coalesce($4,'') || ' ' || array_to_string($5::text[],' ')))
     RETURNING ${META_COLS}`,
    [s.name, s.kind, s.source, s.prompt, s.tags, s.mime, Math.round(s.durationMs), s.audio, toVectorLiteral(s.embedding)],
  );
  return rows[0];
}
