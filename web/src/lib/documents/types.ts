export type DocumentRow = {
  document_id: string;
  client_matter_id: string | null;
  doc_type_code: string;
  title: string;
  status: string;
  received_date: string | null;
  executed_date: string | null;
  dropbox_path: string | null;
  storage_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  original_filename: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  supersedes_document_id: string | null;
  notes: string | null;
  bates_prefix: string | null;
  bates_start: string | null;
  bates_end: string | null;
  created_at: string;
  type_label: string | null;
  type_category: string | null;
  uploader_name: string | null;
  supersedes_title: string | null;
  is_superseded: boolean;
  restricted: boolean;
};

export type AccessLogRow = {
  access_id: number;
  document_id: string;
  staff_id: string;
  action: string;
  accessed_at: string;
  document_title: string | null;
  staff_name: string | null;
};

export type DocTypeOption = {
  code: string;
  label: string;
  category: string;
  restricted: boolean;
};

export const DOC_TYPE_GROUPS: {
  label: string;
  options: { code: string; label: string }[];
}[] = [
  {
    label: "Medical",
    options: [
      { code: "medical_records", label: "Medical records" },
      { code: "medical_bills", label: "Medical bills" },
    ],
  },
  {
    label: "Litigation",
    options: [
      { code: "petition", label: "Petition" },
      { code: "answer", label: "Answer (defendant)" },
      { code: "citation", label: "Citation" },
      { code: "dco", label: "Scheduling order (DCO)" },
      { code: "production", label: "Discovery production (Bates)" },
      { code: "affidavit_18001", label: "§ 18.001 affidavit" },
      { code: "depo_transcript", label: "Deposition transcript" },
    ],
  },
  {
    label: "Investigation",
    options: [
      { code: "police_report", label: "Police / crash report (CR-3)" },
      { code: "photos_video", label: "Photos / video" },
    ],
  },
  {
    label: "Resolution",
    options: [
      { code: "demand_letter", label: "Demand letter" },
      { code: "settlement_release", label: "Release" },
      { code: "settlement_statement", label: "Settlement statement" },
    ],
  },
  {
    label: "Intake & General",
    options: [
      { code: "contract", label: "Contingent-fee contract" },
      { code: "hipaa_auth", label: "HIPAA authorization" },
      { code: "correspondence", label: "Correspondence" },
      { code: "other", label: "Other" },
    ],
  },
];

const RESTRICTED_CATEGORIES = new Set([
  "medical",
  "litigation",
  "liens",
  "resolution",
  "claims",
  "damages",
  "investigation",
]);

export function isRestrictedCategory(category: string | null | undefined): boolean {
  return Boolean(category && RESTRICTED_CATEGORIES.has(category));
}

/** Types that use “Filed / served date” in the upload form. */
export const FILING_DOC_TYPES = new Set([
  "petition",
  "answer",
  "dco",
  "affidavit_18001",
  "citation",
]);

export function statusForUpload(docType: string): string {
  if (docType === "contract") return "executed";
  if (FILING_DOC_TYPES.has(docType)) return "filed";
  return "received";
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\-()+ ]+/g, "_").trim();
  return (base || "file").slice(0, 180);
}
