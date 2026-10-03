import { rootCertificates } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { poolConfig, toVectorLiteral } from '../api/_lib/db';
import { TIGER_ROOT_CA } from '../api/_lib/tiger-ca';

describe('poolConfig (VERIFY-5)', () => {
  const cfg = poolConfig('postgres://u:p@host.example.com:5432/tsdb?sslmode=require');

  it('strips sslmode so the ssl option is not overridden', () => {
    expect(cfg.connectionString).toBe('postgres://u:p@host.example.com:5432/tsdb');
  });

  it('verifies certificates against default roots plus the Tiger CA', () => {
    const ssl = cfg.ssl as { ca: string[]; rejectUnauthorized: boolean };
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toContain(TIGER_ROOT_CA);
    expect(ssl.ca.length).toBe(rootCertificates.length + 1);
  });

  it('uses one connection per function instance', () => {
    expect(cfg.max).toBe(1);
  });
});

describe('toVectorLiteral', () => {
  it('formats a pgvector literal', () => {
    expect(toVectorLiteral([0.1, -2, 3])).toBe('[0.1,-2,3]');
  });
});
