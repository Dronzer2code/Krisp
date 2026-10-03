import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, isUuid, json, methodNotAllowed, queryParam, readJson } from './_lib/http.js';

// docs/TRD.md → API CONTRACTS → /api/workspaces.
//   GET            → { workspaces: [{ id, name, updated_at, colors }] } (colors = first 6 Beat colours)
//   GET ?id=       → { workspace } | 404
//   POST {workspace} → { id, updated_at } (insert when id is null, else upsert by id)
//   DELETE ?id=    → { ok: true } | 404

const MAX_DATA_BYTES = 1_000_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  try {
    switch (req.method) {
      case 'GET': {
        const id = queryParam(req, 'id');
        return id !== undefined ? await getOne(res, id) : await list(res);
      }
      case 'POST':
        return await upsert(req, res);
      case 'DELETE':
        return await remove(res, queryParam(req, 'id'));
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }
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
  const rows = await query<{ id: string; data: Record<string, unknown> }>('SELECT id, data FROM workspaces WHERE id = $1', [id]);
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 200, { workspace: { ...rows[0].data, id: rows[0].id } });
}

interface WorkspaceBody {
  id: string | null;
  name: string;
  version: number;
  rack: unknown[];
  beats: unknown[];
  lanes: unknown[];
  clips: unknown[];
  mixer: object;
}

export function validateWorkspace(w: unknown): string | null {
  if (!w || typeof w !== 'object') return 'workspace must be an object';
  const v = w as Partial<WorkspaceBody>;
  if (v.id !== null && v.id !== undefined && !isUuid(v.id)) return 'invalid id';
  if (typeof v.name !== 'string' || v.name.trim().length === 0 || v.name.length > 100) return 'invalid name';
  if (v.version !== 1) return 'unsupported version';
  for (const key of ['rack', 'beats', 'lanes', 'clips'] as const) if (!Array.isArray(v[key])) return `${key} must be an array`;
  if (!v.mixer || typeof v.mixer !== 'object') return 'mixer must be an object';
  return null;
}

async function upsert(req: VercelRequest, res: VercelResponse) {
  const body = readJson<{ workspace?: unknown }>(req);
  const invalid = validateWorkspace(body?.workspace);
  if (invalid) return error(res, 400, 'invalid', invalid);
  const w = body!.workspace as WorkspaceBody;
  const { id, ...rest } = w;
  const data = JSON.stringify(rest);
  if (data.length > MAX_DATA_BYTES) return error(res, 400, 'invalid', 'workspace too large');
  const name = w.name.trim();
  const rows = id
    ? await query<{ id: string; updated_at: string }>(
        `INSERT INTO workspaces (id, name, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = now()
         RETURNING id, updated_at`,
        [id, name, data],
      )
    : await query<{ id: string; updated_at: string }>(
        'INSERT INTO workspaces (name, data) VALUES ($1, $2::jsonb) RETURNING id, updated_at',
        [name, data],
      );
  json(res, 200, rows[0]);
}

async function remove(res: VercelResponse, id: string | undefined) {
  if (!isUuid(id)) return error(res, 404, 'not_found');
  const rows = await query<{ id: string }>('DELETE FROM workspaces WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) return error(res, 404, 'not_found');
  json(res, 200, { ok: true });
}
