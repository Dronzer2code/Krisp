import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query, toVectorLiteral } from './_lib/db.js';
import { error, isUuid, json, methodNotAllowed, queryParam, readJson } from './_lib/http.js';
import { cleanName, cleanTags, insertSound, isKind, MAX_AUDIO_BYTES, META_COLS, validEmbedding, type SoundMeta } from './_lib/sounds.js';

// docs/TRD.md → API CONTRACTS → /api/sounds.
//   GET ?kind=&limit=  → { sounds: SoundMeta[] } newest first (default 50, max 200)
//   POST { name, kind, tags, mime, durationMs, audioBase64, embedding } → 201 { sound }
//   POST ?copyOf=<id> { name? }        → 201 { sound }  (Make a copy: same audio, tags, embedding)
//   PATCH ?id= { name, embedding? }    → { sound }      (Rename; keyword index rebuilt, vector replaced when given)
//   DELETE ?id=                        → { ok: true }   (also leaves every playlist)

const MIMES = ['audio/wav', 'audio/mpeg', 'audio/ogg'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  try {
    if (req.method === 'GET') return await list(req, res);
    if (req.method === 'POST') return queryParam(req, 'copyOf') !== undefined ? await copy(req, res) : await upload(req, res);
    if (req.method === 'PATCH') return await rename(req, res);
    if (req.method === 'DELETE') return await remove(req, res);
    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
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

async function copy(req: VercelRequest, res: VercelResponse) {
  const id = queryParam(req, 'copyOf');
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const b = readJson<Record<string, unknown>>(req) ?? {};
  const name = b.name === undefined ? null : cleanName(b.name);
  if (b.name !== undefined && !name) return error(res, 400, 'invalid', 'name');
  const rows = await query<SoundMeta>(
    `INSERT INTO sounds (name, kind, source, prompt, tags, mime, duration_ms, audio, embedding, tsv)
     SELECT n.name, s.kind, s.source, s.prompt, s.tags, s.mime, s.duration_ms, s.audio, s.embedding,
            to_tsvector('english', coalesce(n.name,'') || ' ' || coalesce(s.prompt,'') || ' ' || array_to_string(s.tags,' '))
     FROM sounds s, LATERAL (SELECT coalesce($2::text, left(s.name, 95) || ' copy') AS name) n
     WHERE s.id = $1
     RETURNING ${META_COLS}`,
    [id, name],
  );
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 201, { sound: rows[0] });
}

async function rename(req: VercelRequest, res: VercelResponse) {
  const id = queryParam(req, 'id');
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const b = readJson<Record<string, unknown>>(req);
  const name = cleanName(b?.name);
  if (!name) return error(res, 400, 'invalid', 'name');
  if (b?.embedding !== undefined && !validEmbedding(b.embedding)) return error(res, 400, 'invalid', 'embedding must be 384 numbers');
  const embedding = b?.embedding ? toVectorLiteral(b.embedding as number[]) : null;
  const rows = await query<SoundMeta>(
    `UPDATE sounds SET name = $2,
            embedding = coalesce($3::vector, embedding),
            tsv = to_tsvector('english', coalesce($2,'') || ' ' || coalesce(prompt,'') || ' ' || array_to_string(tags,' '))
     WHERE id = $1 RETURNING ${META_COLS}`,
    [id, name, embedding],
  );
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 200, { sound: rows[0] });
}

async function remove(req: VercelRequest, res: VercelResponse) {
  const id = queryParam(req, 'id');
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const rows = await query<{ id: string }>('DELETE FROM sounds WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 200, { ok: true });
}
