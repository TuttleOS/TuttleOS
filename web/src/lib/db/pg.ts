import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 3 });
  }
  return pool;
}
