import { rootCertificates } from 'node:tls';
import pg from 'pg';
import { TIGER_ROOT_CA } from './tiger-ca.js';

// One small pool per function instance, reused across warm invocations (docs/TRD.md → api/_lib/db.ts).
const globalForPool = globalThis as unknown as { pocketPool?: pg.Pool };

// VERIFY-5: TLS with full verification (cert chain + hostname). Trusts Node's default roots plus
// Tiger's private CA, so it works with both Tiger-signed and publicly signed service certs.
// sslmode is stripped from the URL because pg lets URL ssl params override the `ssl` option.
export function poolConfig(databaseUrl: string): pg.PoolConfig {
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: { ca: [...rootCertificates, TIGER_ROOT_CA], rejectUnauthorized: true },
    max: 1,
    idleTimeoutMillis: 10000,
  };
}

export function getPool(): pg.Pool {
  if (!globalForPool.pocketPool) {
    const databaseUrl = process.env.TIGER_DATABASE_URL;
    if (!databaseUrl) throw new Error('database_not_configured');
    globalForPool.pocketPool = new pg.Pool(poolConfig(databaseUrl));
  }
  return globalForPool.pocketPool;
}

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

// pgvector literal: '[f1,f2,...]'
export function toVectorLiteral(values: number[]): string {
  return '[' + values.join(',') + ']';
}
