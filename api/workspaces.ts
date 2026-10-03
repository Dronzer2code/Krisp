import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, isUuid, json, methodNotAllowed, queryParam } from './_lib/http.js';

// docs/TRD.md → API CONTRACTS → /api/workspaces. T0b: GET. POST/DELETE land in T6.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  try {
    if (req.method === 'GET') {
      const id = queryParam(req, 'id');
      if (id !== undefined) return await getOne(res, id);
      return await list(res);
    }
    return methodNotAllowed(res, ['GET']);
  } catch (err) {
    console.error('workspaces failed:', err instanceof Error ? err.message : 'unknown error');
    return error(res, 500, 'server_error');
  }
}

async function list(res: VercelResponse) {
  const rows = await query<{ id: string; name: string; updated_at: string; colors: string[] }>(
    `SELECT w.id, w.name, w.updated_at,
            coalesce((SELECT array_agg(b->>'color')
                      FROM (SELECT b FROM jsonb_array_elements(coalesce(w.data->'beats','[]'::jsonb)) b LIMIT 6) x),
                     '{}') AS colors
     FROM workspaces w
     ORDER BY w.updated_at DESC`,
  );
  json(res, 200, { workspaces: rows });
}

async function getOne(res: VercelResponse, id: string) {
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const rows = await query<{ id: string; data: Record<string, unknown> }>(
    'SELECT id, data FROM workspaces WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 200, { workspace: { ...rows[0].data, id: rows[0].id } });
}
