import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query, toVectorLiteral } from './_lib/db.js';
import { error, json, methodNotAllowed, readJson } from './_lib/http.js';
import { isKind, validEmbedding, type SoundMeta } from './_lib/sounds.js';

// docs/TRD.md → Hybrid search query: pgvector cosine + full-text, reciprocal rank fusion (k = 60).
// POST { q, embedding, kind? } → { results: (SoundMeta & { score, vector_hit, keyword_hit })[] }

export const HYBRID_SQL = `
WITH v AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector) AS r
  FROM sounds WHERE ($3::text IS NULL OR kind = $3)
  ORDER BY embedding <=> $1::vector LIMIT 50
), k AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank(tsv, q) DESC) AS r
  FROM sounds, websearch_to_tsquery('english', $2) q
  WHERE tsv @@ q AND ($3::text IS NULL OR kind = $3)
  ORDER BY ts_rank(tsv, q) DESC LIMIT 50
)
SELECT s.id, s.name, s.kind, s.source, s.prompt, s.tags, s.duration_ms, s.created_at,
       coalesce(1.0/(60+v.r),0) + coalesce(1.0/(60+k.r),0) AS score,
       v.r IS NOT NULL AS vector_hit, k.r IS NOT NULL AS keyword_hit
FROM sounds s LEFT JOIN v ON v.id = s.id LEFT JOIN k ON k.id = s.id
WHERE v.id IS NOT NULL OR k.id IS NOT NULL
ORDER BY score DESC LIMIT 20;`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const b = readJson<Record<string, unknown>>(req);
  const q = typeof b?.q === 'string' ? b.q.trim().slice(0, 200) : '';
  if (!q) return error(res, 400, 'invalid', 'q');
  if (!validEmbedding(b?.embedding)) return error(res, 400, 'invalid', 'embedding must be 384 numbers');
  const kind = b?.kind;
  if (kind !== undefined && kind !== null && !isKind(kind)) return error(res, 400, 'invalid', 'kind');
  try {
    const rows = await query<SoundMeta & { score: string; vector_hit: boolean; keyword_hit: boolean }>(HYBRID_SQL, [
      toVectorLiteral(b!.embedding as number[]),
      q,
      kind ?? null,
    ]);
    json(res, 200, { results: rows.map((r) => ({ ...r, score: Number(r.score) })) });
  } catch (err) {
    console.error('search failed:', err instanceof Error ? err.message : 'unknown error');
    error(res, 500, 'server_error');
  }
}
