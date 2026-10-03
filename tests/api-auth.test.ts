import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { passcodeMatches, requirePasscode } from '../api/_lib/auth';

function mockRes() {
  const res = {
    statusCode: 0,
    body: '',
    status(code: number) { this.statusCode = code; return this; },
    setHeader() { return this; },
    send(body: string) { this.body = body; return this; },
  };
  return res;
}

const req = (passcode?: string) =>
  ({ headers: passcode === undefined ? {} : { 'x-app-passcode': passcode } }) as unknown as VercelRequest;

describe('requirePasscode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the correct passcode', () => {
    vi.stubEnv('APP_PASSCODE', 'studio-123');
    const res = mockRes();
    expect(requirePasscode(req('studio-123'), res as unknown as VercelResponse)).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['wrong', 'studio-124'],
    ['empty', ''],
  ])('rejects a %s passcode with 401', (_label, given) => {
    vi.stubEnv('APP_PASSCODE', 'studio-123');
    const res = mockRes();
    expect(requirePasscode(req(given), res as unknown as VercelResponse)).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'unauthorized' });
  });

  it('rejects everything when APP_PASSCODE is not configured', () => {
    vi.stubEnv('APP_PASSCODE', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    expect(requirePasscode(req(''), res as unknown as VercelResponse)).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('passcodeMatches handles different lengths', () => {
    expect(passcodeMatches('a', 'abcdef')).toBe(false);
  });
});
