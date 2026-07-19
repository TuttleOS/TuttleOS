/** Case document Storage (sql/16). Always on; hide only via FEATURE flag = false. */
export function documentsEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_FEATURE_DOCUMENTS;
  if (flag == null || flag === "") return true;
  return flag.toLowerCase() !== "false" && flag !== "0";
}

export const CASE_DOCUMENTS_BUCKET = "case-documents";

/** Max bytes — keep in sync with Supabase bucket file size limit (50 MB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
