import 'server-only';

import { Pool } from 'pg';

declare global {
  var baokuangaixiePostgresPool: Pool | undefined;
}

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  globalThis.baokuangaixiePostgresPool ??= new Pool({ connectionString });
  return globalThis.baokuangaixiePostgresPool;
}
