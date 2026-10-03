import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePasscode } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { error, json, methodNotAllowed, readJson } from './_lib/http.js';
import { cleanName, cleanTags, insertSound, isKind, validEmbedding } from './_lib/sounds.js';

// docs/TRD.md → /api/sound-generate. ElevenLabs Sound Effects (VERIFY-3):
// POST https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128, header xi-api-key,
// body { text, duration_seconds (0.5–30), prompt_influence, loop }. Usage is only counted on success.

const EL_URL = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
const LIMITS = { ONE_SHOT: [0.5, 2], LOOP: [1, 30] } as const;

function dailyLimit(): number {
  const n = Number(process.env.DAILY_SOUND_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 40;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePasscode(req, res)) return;
  if (req.method === 'GET') return remaining(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  try {
    return await generate(req, res);
  } catch (err) {
    console.error('sound-generate failed:', err instanceof Error ? err.message : 'unknown error');
    return error(res, 500, 'server_error');
  }
}

async function usedToday(): Promise<number> {
  await query('INSERT INTO sound_usage (day, count) VALUES (current_date, 0) ON CONFLICT DO NOTHING');
  const rows = await query<{ count: number }>('SELECT count FROM sound_usage WHERE day = current_date');
  return rows[0]?.count ?? 0;
}

/** GET → { remainingToday, limit } so the Create tab can show the counter before generating. */
async function remaining(res: VercelResponse) {
  try {
    const used = await usedToday();
    json(res, 200, { remainingToday: Math.max(0, dailyLimit() - used), limit: dailyLimit() });
  } catch (err) {
    console.error('sound-generate remaining failed:', err instanceof Error ? err.message : 'unknown error');
    error(res, 500, 'server_error');
  }
}

async function generate(req: VercelRequest, res: VercelResponse) {
  const b = readJson<Record<string, unknown>>(req);
  if (!b) return error(res, 400, 'invalid', 'body');
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : '';
  if (prompt.length < 3 || prompt.length > 300) return error(res, 400, 'invalid', 'prompt must be 3–300 characters');
  if (!isKind(b.kind)) return error(res, 400, 'invalid', 'kind');
  const seconds = Number(b.durationSeconds);
  const [lo, hi] = LIMITS[b.kind];
  if (!Number.isFinite(seconds) || seconds < lo || seconds > hi) return error(res, 400, 'invalid', `durationSeconds must be ${lo}–${hi}`);
  const name = cleanName(b.name);
  const tags = cleanTags(b.tags);
  if (!name || !tags) return error(res, 400, 'invalid', 'name/tags');
  if (!validEmbedding(b.embedding)) return error(res, 400, 'invalid', 'embedding must be 384 numbers');

  const limit = dailyLimit();
  const used = await usedToday();
  if (used >= limit) return error(res, 429, 'daily_limit');

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return error(res, 502, 'elevenlabs_error', 'ElevenLabs is not configured');

  const el = await fetch(EL_URL, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.5, loop: b.kind === 'LOOP' }),
  });
  if (!el.ok) {
    const detail = (await el.text().catch(() => '')).slice(0, 300);
    return error(res, 502, 'elevenlabs_error', `${el.status} ${detail}`);
  }
  const audio = Buffer.from(await el.arrayBuffer());
  const sound = await insertSound({ name, kind: b.kind, source: 'ELEVENLABS', prompt, tags, mime: 'audio/mpeg', durationMs: seconds * 1000, audio, embedding: b.embedding });
  await query('UPDATE sound_usage SET count = count + 1 WHERE day = current_date');
  json(res, 201, { sound, remainingToday: Math.max(0, limit - used - 1) });
}
