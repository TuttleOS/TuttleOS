import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Server-only client that bypasses RLS — use only for clearance checks that staff cannot SELECT. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "your_service_role_key_here") return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
