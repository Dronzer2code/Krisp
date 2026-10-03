import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, json, methodNotAllowed, queryParam, readJson } from './_lib/http.js';
import { cleanName, cleanTags, insertSound, isKind, MAX_AUDIO_BYTES, META_COLS, validEmbedding, type SoundMeta } from './_lib/sounds.js';

// docs/TRD.md → API CONTRACTS → /api/sounds.
//   GET ?kind=&limit=  → { sounds: SoundMeta[] } newest first (default 50, max 200)
//   POST { name, kind, tags, mime, durationMs, audioBase64, embedding } → 201 { sound }

const MIMES = ['audio/wav', 'audio/mpeg', 'audio/ogg'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  try {
    if (req.method === 'GET') return await list(req, res);
    if (req.method === 'POST') return await upload(req, res);
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    console.error('sounds failed:', err instanceof Error ? err.message : 'unknown error');
    return error(res, 500, 'server_error');
  }
}

async function list(req: VercelRequest, res: VercelResponse) {
  const kind = queryParam(req, 'kind');
  if (kind !== undefined && kind !== '' && !isKind(kind)) return error(res, 400, 'invalid', 'kind');
  const limit = Math.min(200, Math.max(1, Number(queryParam(req, 'limit')) || 50));
  const rows = await query<SoundMeta>(
    `SELECT ${META_COLS} FROM sounds WHERE ($1::text IS NULL OR kind = $1) ORDER BY created_at DESC LIMIT $2`,
    [kind || null, limit],
  );
  json(res, 200, { sounds: rows });
}

async function upload(req: VercelRequest, res: VercelResponse) {
  const b = readJson<Record<string, unknown>>(req);
  if (!b) return error(res, 400, 'invalid', 'body');
  const name = cleanName(b.name);
  const tags = cleanTags(b.tags);
  if (!name) return error(res, 400, 'invalid', 'name');
  if (!tags) return error(res, 400, 'invalid', 'tags');
  if (!isKind(b.kind)) return error(res, 400, 'invalid', 'kind');
  if (typeof b.mime !== 'string' || !MIMES.includes(b.mime)) return error(res, 400, 'invalid', 'mime must be audio/wav, audio/mpeg or audio/ogg');
  const durationMs = Number(b.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 10 * 60 * 1000) return error(res, 400, 'invalid', 'durationMs');
  if (!validEmbedding(b.embedding)) return error(res, 400, 'invalid', 'embedding must be 384 numbers');
  if (typeof b.audioBase64 !== 'string' || b.audioBase64.length === 0) return error(res, 400, 'invalid', 'audioBase64');
  const audio = Buffer.from(b.audioBase64, 'base64');
  if (audio.length === 0) return error(res, 400, 'invalid', 'audio');
  if (audio.length > MAX_AUDIO_BYTES) return error(res, 400, 'invalid', 'decoded size > 3 MB');
  const sound = await insertSound({ name, kind: b.kind, source: 'UPLOAD', prompt: null, tags, mime: b.mime, durationMs, audio, embedding: b.embedding });
  json(res, 201, { sound });
}
