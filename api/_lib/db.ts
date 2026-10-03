import pg from 'pg';

// One small pool per function instance, reused across warm invocations (docs/TRD.md → api/_lib/db.ts).
const globalForPool = globalThis as unknown as { pocketPool?: pg.Pool };

export function getPool(): pg.Pool {
  if (!globalForPool.pocketPool) {
    const connectionString = process.env.TIGER_DATABASE_URL;
    if (!connectionString) throw new Error('database_not_configured');
    globalForPool.pocketPool = new pg.Pool({ connectionString, max: 1, idleTimeoutMillis: 10000 });
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
