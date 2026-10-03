import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, isUuid, methodNotAllowed, queryParam } from './_lib/http.js';

// docs/TRD.md → /api/sound-audio?id= → audio bytes, Content-Type = stored mime, immutable cache.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const id = queryParam(req, 'id');
  if (!isUuid(id)) return error(res, 404, 'not_found');
  try {
    const rows = await query<{ mime: string; audio: Buffer }>('SELECT mime, audio FROM sounds WHERE id = $1', [id]);
    if (rows.length === 0) return error(res, 404, 'not_found');
    res.status(200);
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(rows[0].audio.length));
    res.end(rows[0].audio);
  } catch (err) {
    console.error('sound-audio failed:', err instanceof Error ? err.message : 'unknown error');
    error(res, 500, 'server_error');
  }
}
