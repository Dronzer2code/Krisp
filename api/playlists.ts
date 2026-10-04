import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, isUuid, json, methodNotAllowed, queryParam, readJson } from './_lib/http.js';

// Library playlists (folders for Sounds; db/migrations/002_playlists.sql). docs/TRD.md → API CONTRACTS.
//   GET                                → { playlists: [{ id, name, created_at, sound_ids }] } (name order)
//   POST { name }                      → 201 { playlist }
//   PATCH ?id= { name }                → { playlist }
//   DELETE ?id=                        → { ok: true }   (Sounds are kept)
//   POST ?op=add    { playlistId, soundId }            → { ok: true }  (idempotent)
//   POST ?op=remove { playlistId, soundId }            → { ok: true }
//   POST ?op=move   { soundId, from: id | null, to }   → { ok: true }  (from null = from unsorted)

export interface Playlist {
  id: string;
  name: string;
  created_at: string;
  sound_ids: string[];
}

export function cleanPlaylistName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().replace(/\s+/g, ' ').slice(0, 60);
  return n.length ? n : null;
}

const SELECT = `SELECT p.id, p.name, p.created_at,
       coalesce(array_agg(ps.sound_id ORDER BY ps.added_at) FILTER (WHERE ps.sound_id IS NOT NULL), '{}') AS sound_ids
FROM playlists p LEFT JOIN playlist_sounds ps ON ps.playlist_id = p.id`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  try {
    switch (req.method) {
      case 'GET':
        return json(res, 200, { playlists: await query<Playlist>(`${SELECT} GROUP BY p.id ORDER BY lower(p.name), p.created_at`) });
      case 'POST': {
        const op = queryParam(req, 'op');
        if (op === undefined) return await create(req, res);
        return await membership(op, req, res);
      }
      case 'PATCH':
        return await rename(req, res);
      case 'DELETE': {
        const id = queryParam(req, 'id');
        if (!isUuid(id)) return error(res, 404, 'not_found');
        const rows = await query('DELETE FROM playlists WHERE id = $1 RETURNING id', [id]);
        return rows.length ? json(res, 200, { ok: true }) : error(res, 404, 'not_found');
      }
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
    }
  } catch (err) {
    console.error('playlists failed:', err instanceof Error ? err.message : 'unknown error');
    return error(res, 500, 'server_error');
  }
}

async function create(req: VercelRequest, res: VercelResponse) {
  const name = cleanPlaylistName(readJson<Record<string, unknown>>(req)?.name);
  if (!name) return error(res, 400, 'invalid', 'name');
  const rows = await query<Playlist>(
    `WITH p AS (INSERT INTO playlists (name) VALUES ($1) RETURNING id, name, created_at)
     SELECT id, name, created_at, '{}'::uuid[] AS sound_ids FROM p`,
    [name],
  );
  json(res, 201, { playlist: rows[0] });
}

async function rename(req: VercelRequest, res: VercelResponse) {
  const id = queryParam(req, 'id');
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const name = cleanPlaylistName(readJson<Record<string, unknown>>(req)?.name);
  if (!name) return error(res, 400, 'invalid', 'name');
  const upd = await query('UPDATE playlists SET name = $2 WHERE id = $1 RETURNING id', [id, name]);
  if (!upd.length) return error(res, 404, 'not_found');
  const rows = await query<Playlist>(`${SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]);
  json(res, 200, { playlist: rows[0] });
}

async function membership(op: string, req: VercelRequest, res: VercelResponse) {
  const b = readJson<Record<string, unknown>>(req) ?? {};
  const soundId = b.soundId;
  if (!isUuid(typeof soundId === 'string' ? soundId : undefined)) return error(res, 400, 'invalid', 'soundId');
  const insert = `INSERT INTO playlist_sounds (playlist_id, sound_id)
                  SELECT p.id, s.id FROM playlists p, sounds s WHERE p.id = $1 AND s.id = $2
                  ON CONFLICT DO NOTHING RETURNING playlist_id`;
  const exists = async (playlistId: string) =>
    (await query('SELECT 1 FROM playlists p, sounds s WHERE p.id = $1 AND s.id = $2', [playlistId, soundId])).length > 0;

  if (op === 'add' || op === 'remove') {
    const playlistId = typeof b.playlistId === 'string' ? b.playlistId : undefined;
    if (!isUuid(playlistId)) return error(res, 400, 'invalid', 'playlistId');
    if (op === 'add') {
      await query(insert, [playlistId, soundId]);
      if (!(await exists(playlistId))) return error(res, 404, 'not_found');
    } else {
      await query('DELETE FROM playlist_sounds WHERE playlist_id = $1 AND sound_id = $2', [playlistId, soundId]);
    }
    return json(res, 200, { ok: true });
  }

  if (op === 'move') {
    const to = typeof b.to === 'string' ? b.to : undefined;
    const from = b.from === null || b.from === undefined ? null : typeof b.from === 'string' ? b.from : 'invalid';
    if (!isUuid(to)) return error(res, 400, 'invalid', 'to');
    if (from !== null && !isUuid(from)) return error(res, 400, 'invalid', 'from');
    if (!(await exists(to))) return error(res, 404, 'not_found');
    // One statement: leave the source playlist and join the target.
    await query(
      `WITH gone AS (DELETE FROM playlist_sounds WHERE $3::uuid IS NOT NULL AND playlist_id = $3 AND sound_id = $2 AND playlist_id <> $1)
       INSERT INTO playlist_sounds (playlist_id, sound_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [to, soundId, from],
    );
    return json(res, 200, { ok: true });
  }

  return error(res, 400, 'invalid', 'op must be add, remove or move');
}
