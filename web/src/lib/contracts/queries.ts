import { createClient } from "@/lib/supabase/server";
import { getPgPool } from "@/lib/db/pg";
import type { ContractPackage, ContractSigner } from "./types";

const PACKAGE_COLS =
  "contract_package_id, primary_intake_lead_id, public_token, status, client_display_names, incident_location, incident_date, cause_phrase, fee_pre_suit, fee_post_filing, fee_appeal, rendered_body, artifact_html, primary_document_id, sent_at, executed_at, expires_at, created_at, created_by, firm_signature_typed_name, firm_signed_at, firm_signed_by";

const PACKAGE_COLS_WITH_FIRM_INK =
  `${PACKAGE_COLS}, firm_signature_data`;

export async function getActivePackageForLead(
  leadId: string,
): Promise<(ContractPackage & { signers: ContractSigner[] }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("contract_package")
    .select(PACKAGE_COLS)
    .eq("primary_intake_lead_id", leadId)
    .is("deleted_at", null)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: signers, error: sErr } = await supabase
    .schema("workflow")
    .from("contract_signer")
    .select(
      "contract_signer_id, contract_package_id, sort_order, full_name, email, phone, intake_lead_id, person_id, status, signed_at, signature_typed_name",
    )
    .eq("contract_package_id", data.contract_package_id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (sErr) throw new Error(sErr.message);

  let has_pdf = false;
  const pool = getPgPool();
  if (pool) {
    const { rows } = await pool.query(
      `SELECT coalesce(length(artifact_pdf_base64), 0) > 100 AS has_pdf
       FROM workflow.contract_package WHERE contract_package_id = $1`,
      [data.contract_package_id],
    );
    has_pdf = Boolean(rows[0]?.has_pdf);
  }

  return {
    ...(data as ContractPackage),
    fee_pre_suit: Number(data.fee_pre_suit),
    fee_post_filing: Number(data.fee_post_filing),
    fee_appeal: Number(data.fee_appeal),
    has_pdf,
    signers: (signers ?? []) as ContractSigner[],
  };
}

export async function listCompanionLeadOptions(excludeLeadId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("intake_lead")
    .select(
      "intake_lead_id, raw_name, raw_phone, raw_email, status, person:person_id(person_id, first_name, last_name)",
    )
    .is("deleted_at", null)
    .neq("intake_lead_id", excludeLeadId)
    .in("status", ["open", "contract_sent", "signed"])
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const person = row.person as
      | { person_id: string; first_name: string; last_name: string }
      | { person_id: string; first_name: string; last_name: string }[]
      | null;
    const p = Array.isArray(person) ? person[0] : person;
    const name = p
      ? `${p.last_name}, ${p.first_name}`
      : row.raw_name || "Unnamed lead";
    return {
      intake_lead_id: row.intake_lead_id as string,
      name,
      email: (row.raw_email as string | null) ?? null,
      phone: (row.raw_phone as string | null) ?? null,
      person_id: p?.person_id ?? null,
      status: row.status as string,
    };
  });
}

export type StaffContractViewSigner = ContractSigner & {
  signature_data: string | null;
};

export async function getContractPackageForStaffView(packageId: string): Promise<
  | (ContractPackage & { signers: StaffContractViewSigner[]; has_pdf: boolean })
  | null
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("contract_package")
    .select(PACKAGE_COLS_WITH_FIRM_INK)
    .eq("contract_package_id", packageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: signers, error: sErr } = await supabase
    .schema("workflow")
    .from("contract_signer")
    .select(
      "contract_signer_id, contract_package_id, sort_order, full_name, email, phone, intake_lead_id, person_id, status, signed_at, signature_typed_name, signature_data",
    )
    .eq("contract_package_id", packageId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (sErr) throw new Error(sErr.message);

  let has_pdf = false;
  const pool = getPgPool();
  if (pool) {
    const { rows } = await pool.query(
      `SELECT coalesce(length(artifact_pdf_base64), 0) > 100 AS has_pdf
       FROM workflow.contract_package WHERE contract_package_id = $1`,
      [packageId],
    );
    has_pdf = Boolean(rows[0]?.has_pdf);
  }

  return {
    ...(data as ContractPackage),
    fee_pre_suit: Number(data.fee_pre_suit),
    fee_post_filing: Number(data.fee_post_filing),
    fee_appeal: Number(data.fee_appeal),
    has_pdf,
    signers: (signers ?? []) as StaffContractViewSigner[],
  };
}
