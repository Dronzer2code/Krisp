import { createHash, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { error } from './http.js';

// Hashing both sides gives equal-length buffers for timingSafeEqual without leaking length.
function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function passcodeMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

// Returns true when the request may proceed; otherwise has already sent 401.
export function requirePasscode(req: VercelRequest, res: VercelResponse): boolean {
  const header = req.headers['x-app-passcode'];
  const given = Array.isArray(header) ? header[0] : header;
  const expected = process.env.APP_PASSCODE;
  if (!expected) console.error('APP_PASSCODE is not configured; rejecting request');
  if (passcodeMatches(given, expected)) return true;
  error(res, 401, 'unauthorized');
  return false;
}
