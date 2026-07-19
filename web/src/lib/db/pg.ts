import { Pool } from "pg";

let pool: Pool | null = null;

function needsSsl(url: string): boolean {
  if (/localhost|127\.0\.0\.1/i.test(url)) return false;
  return true;
}

/** Shared pool for public signing + PDF probes. Returns null if DATABASE_URL unset. */
export function getPgPool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 3,
      // Supabase requires TLS; rejectUnauthorized false matches common serverless setups.
      ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", (err) => {
      console.error("[pg] idle client error", err.message);
    });
  }
  return pool;
}
