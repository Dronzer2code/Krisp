import type { VercelRequest, VercelResponse } from '@vercel/node';

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export function error(res: VercelResponse, status: number, code: string, detail?: string): void {
  json(res, status, detail === undefined ? { error: code } : { error: code, detail });
}

// Vercel parses JSON bodies into req.body; fall back to parsing a raw string.
export function readJson<T = unknown>(req: VercelRequest): T | null {
  const body: unknown = req.body;
  if (body == null || body === '') return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') return body as T;
  return null;
}

export function queryParam(req: VercelRequest, name: string): string | undefined {
  const value = req.query[name];
  return Array.isArray(value) ? value[0] : value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  error(res, 405, 'method_not_allowed');
}
