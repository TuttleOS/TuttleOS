import { Pool } from "pg";

let pool: Pool | null = null;

function needsSsl(url: string): boolean {
  if (/localhost|127\.0\.0\.1/i.test(url)) return false;
  return true;
}

/**
 * pg treats sslmode=require as verify-full (fails on Supabase's chain).
 * Strip query sslmode and set ssl explicitly for serverless.
 */
function normalizeDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    // URL() turns postgres:// into http-like; rebuild with original protocol.
    const protocol = url.startsWith("postgres://")
      ? "postgres:"
      : "postgresql:";
    return `${protocol}//${u.username}:${u.password}@${u.host}${u.pathname}${
      u.searchParams.toString() ? `?${u.searchParams}` : ""
    }`;
  } catch {
    return url
      .replace(/([?&])sslmode=[^&]*/g, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** Shared pool for public signing + PDF probes. Returns null if DATABASE_URL unset. */
export function getPgPool(): Pool | null {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;
  if (!pool) {
    const connectionString = normalizeDatabaseUrl(raw);
    pool = new Pool({
      connectionString,
      max: 3,
      ssl: needsSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", (err) => {
      console.error("[pg] idle client error", err.message);
    });
  }
  return pool;
}
