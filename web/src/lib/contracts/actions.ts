"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import { formatDate } from "@/lib/dates";
import { getPgPool } from "@/lib/db/pg";
import type { PoolClient } from "pg";
import { buildContractPdfBase64 } from "./pdf";
import { buildContractBody, buildMergeFields } from "./template";
import { publicAppUrl } from "./urls";
import type { SignerInput } from "./types";

export type ActionResult =
  | { ok: true; message?: string; token?: string; packageId?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in or staff not linked");
  return staff;
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function bodyHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

/** Seed / system staff — used when public portal writes need an audit actor. */
const PORTAL_AUDIT_STAFF_ID = "00000000-0000-0000-0000-00000000c0de";

async function withPortalAuditTx<T>(
  actorId: string | null | undefined,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPgPool();
  if (!pool) throw new Error("Signing unavailable");
  const client = await pool.connect();
  const actor = actorId || PORTAL_AUDIT_STAFF_ID;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.staff_id', $1, true)`, [actor]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function createOrUpdateContractDraftAction(input: {
  leadId: string;
  location: string;
  incidentDate: string;
  causePhrase: string;
  feePreSuit: number;
  feePostFiling: number;
  feeAppeal: number;
  signers: SignerInput[];
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!input.signers.length) {
      return { ok: false, error: "Add at least one signer" };
    }
    if (!input.location.trim() || !input.incidentDate) {
      return { ok: false, error: "Location and incident date required" };
    }

    const supabase = createClient();
    const names = input.signers.map((s) => s.full_name.trim()).filter(Boolean);
    const clientNames = names.join(" and ");

    const merge = buildMergeFields({
      clientNames,
      location: input.location,
      incidentDateDisplay: formatDate(input.incidentDate),
      causePhrase: input.causePhrase || "car accident",
      feePreSuit: input.feePreSuit,
      feePostFiling: input.feePostFiling,
      feeAppeal: input.feeAppeal,
    });
    const body = buildContractBody(merge);

    const { data: existing } = await supabase
      .schema("workflow")
      .from("contract_package")
      .select("contract_package_id, status, public_token")
      .eq("primary_intake_lead_id", input.leadId)
      .is("deleted_at", null)
      .in("status", ["draft", "sent", "partially_signed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== "draft") {
      return {
        ok: false,
        error:
          "A contract is already out for signature. Void it before drafting a new one.",
      };
    }

    let packageId = existing?.contract_package_id as string | undefined;
    const token = (existing?.public_token as string | undefined) ?? newToken();

    if (packageId) {
      const { error } = await supabase
        .schema("workflow")
        .from("contract_package")
        .update({
          client_display_names: clientNames,
          incident_location: input.location.trim(),
          incident_date: input.incidentDate,
          cause_phrase: input.causePhrase.trim() || "car accident",
          fee_pre_suit: input.feePreSuit,
          fee_post_filing: input.feePostFiling,
          fee_appeal: input.feeAppeal,
          rendered_body: body,
        })
        .eq("contract_package_id", packageId);
      if (error) return { ok: false, error: error.message };

      await supabase
        .schema("workflow")
        .from("contract_signer")
        .update({ deleted_at: new Date().toISOString() })
        .eq("contract_package_id", packageId)
        .is("deleted_at", null);
    } else {
      const { data: created, error } = await supabase
        .schema("workflow")
        .from("contract_package")
        .insert({
          primary_intake_lead_id: input.leadId,
          public_token: token,
          status: "draft",
          client_display_names: clientNames,
          incident_location: input.location.trim(),
          incident_date: input.incidentDate,
          cause_phrase: input.causePhrase.trim() || "car accident",
          fee_pre_suit: input.feePreSuit,
          fee_post_filing: input.feePostFiling,
          fee_appeal: input.feeAppeal,
          rendered_body: body,
          created_by: staff.staff_id,
          expires_at: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .select("contract_package_id")
        .single();
      if (error) return { ok: false, error: error.message };
      packageId = created.contract_package_id;
    }

    const signerRows = input.signers.map((s, i) => ({
      contract_package_id: packageId!,
      sort_order: i,
      full_name: s.full_name.trim(),
      email: s.email?.trim() || null,
      phone: s.phone?.trim() || null,
      intake_lead_id: s.intake_lead_id || null,
      person_id: s.person_id || null,
      status: "pending" as const,
    }));

    const { error: sErr } = await supabase
      .schema("workflow")
      .from("contract_signer")
      .insert(signerRows);
    if (sErr) return { ok: false, error: sErr.message };

    revalidatePath(`/intake/leads/${input.leadId}`);
    return {
      ok: true,
      message: "Contract draft saved",
      packageId,
      token,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function sendContractPackageAction(
  packageId: string,
  leadId: string,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();

    const { data: pkg, error } = await supabase
      .schema("workflow")
      .from("contract_package")
      .select("contract_package_id, status, public_token, rendered_body")
      .eq("contract_package_id", packageId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!pkg) return { ok: false, error: "Package not found" };
    if (pkg.status === "executed") {
      return { ok: false, error: "Already executed" };
    }

    const { error: uErr } = await supabase
      .schema("workflow")
      .from("contract_package")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .eq("contract_package_id", packageId);
    if (uErr) return { ok: false, error: uErr.message };

    await supabase.schema("core").from("intake_lead").update({
      status: "contract_sent",
    }).eq("intake_lead_id", leadId);

    const link = `${publicAppUrl()}/sign/${pkg.public_token}`;
    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "outbound",
      summary: `Contract package sent for e-sign: ${link}`,
    });

    revalidatePath(`/intake/leads/${leadId}`);
    revalidatePath("/intake");
    return {
      ok: true,
      message: "Contract link ready — share with all parties",
      token: pkg.public_token as string,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function voidContractPackageAction(
  packageId: string,
  leadId: string,
): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const { error } = await supabase
      .schema("workflow")
      .from("contract_package")
      .update({ status: "void", deleted_at: new Date().toISOString() })
      .eq("contract_package_id", packageId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/intake/leads/${leadId}`);
    return { ok: true, message: "Contract package voided" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Staff: rebuild PDF + file documents when all parties signed but artifact missing. */
export async function recoverContractPdfAction(
  packageId: string,
  leadId: string,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!getPgPool()) return { ok: false, error: "Database unavailable" };

    const result = await withPortalAuditTx(staff.staff_id, async (client) => {
      const { rows: pkgs } = await client.query(
        `SELECT status, artifact_pdf_base64, created_by
         FROM workflow.contract_package
         WHERE contract_package_id = $1 AND deleted_at IS NULL`,
        [packageId],
      );
      const pkg = pkgs[0];
      if (!pkg) return { ok: false as const, error: "Package not found" };

      const { rows: signers } = await client.query(
        `SELECT status FROM workflow.contract_signer
         WHERE contract_package_id = $1 AND deleted_at IS NULL`,
        [packageId],
      );
      if (!signers.length) {
        return { ok: false as const, error: "No signers on package" };
      }
      if (signers.some((s: { status: string }) => s.status !== "signed")) {
        return {
          ok: false as const,
          error: "Not all parties have signed yet",
        };
      }

      if (pkg.artifact_pdf_base64 && String(pkg.artifact_pdf_base64).length > 100) {
        return { ok: true as const, message: "PDF already on file" };
      }

      await finalizeExecutedPackagePg(client, packageId);
      return { ok: true as const, message: "Signed PDF generated and filed" };
    });

    revalidatePath(`/intake/leads/${leadId}`);
    revalidatePath("/intake");
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Attorney/admin: draw+type countersignature for Tuttle Law Firm, rebuild PDF. */
export async function firmCountersignContractAction(input: {
  packageId: string;
  typedName: string;
  signatureData: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff.is_attorney && staff.role_code !== "admin") {
      return {
        ok: false,
        error: "Only attorney or admin may countersign for the firm",
      };
    }
    if (!input.typedName.trim()) {
      return { ok: false, error: "Type your name for the firm signature" };
    }
    if (
      !input.signatureData?.startsWith("data:image/") ||
      input.signatureData.length < 200
    ) {
      return { ok: false, error: "Please draw your firm signature" };
    }
    if (!getPgPool()) return { ok: false, error: "Database unavailable" };

    const result = await withPortalAuditTx(staff.staff_id, async (client) => {
      const { rows: pkgs } = await client.query(
        `SELECT * FROM workflow.contract_package
         WHERE contract_package_id = $1 AND deleted_at IS NULL`,
        [input.packageId],
      );
      const pkg = pkgs[0];
      if (!pkg) return { ok: false as const, error: "Package not found" };

      const { rows: signers } = await client.query(
        `SELECT status FROM workflow.contract_signer
         WHERE contract_package_id = $1 AND deleted_at IS NULL`,
        [input.packageId],
      );
      if (
        !signers.length ||
        signers.some((s: { status: string }) => s.status !== "signed")
      ) {
        return {
          ok: false as const,
          error: "All client parties must sign before firm countersign",
        };
      }

      await client.query(
        `UPDATE workflow.contract_package SET
           firm_signature_data = $2,
           firm_signature_typed_name = $3,
           firm_signed_at = now(),
           firm_signed_by = $4
         WHERE contract_package_id = $1`,
        [
          input.packageId,
          input.signatureData.slice(0, 200_000),
          input.typedName.trim(),
          staff.staff_id,
        ],
      );

      await finalizeExecutedPackagePg(client, input.packageId);

      await client.query(
        `INSERT INTO workflow.communication_log
           (intake_lead_id, staff_id, channel, direction, summary)
         VALUES ($1, $2, 'portal', 'internal', $3)`,
        [
          pkg.primary_intake_lead_id,
          staff.staff_id,
          `Firm countersigned by ${input.typedName.trim()} for Tuttle Law Firm`,
        ],
      );

      return {
        ok: true as const,
        message: "Firm signature applied — PDF updated",
        leadId: String(pkg.primary_intake_lead_id),
      };
    });

    if (result.ok && "leadId" in result && result.leadId) {
      revalidatePath(`/intake/leads/${result.leadId}`);
    }
    revalidatePath(`/intake/contracts/${input.packageId}`);
    revalidatePath("/intake");
    return result.ok
      ? { ok: true, message: result.message }
      : { ok: false, error: result.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Public package load via DATABASE_URL (bypasses RLS; token is the auth). */
export async function getPublicContractByToken(token: string) {
  const pool = getPgPool();
  if (!pool) return { ok: false as const, error: "Signing unavailable" };

  const { rows } = await pool.query(
    `SELECT * FROM workflow.contract_package
     WHERE public_token = $1 AND deleted_at IS NULL`,
    [token],
  );
  const pkg = rows[0];
  if (!pkg) return { ok: false as const, error: "Link not found" };
  if (pkg.status === "void") {
    return { ok: false as const, error: "This link has been voided" };
  }
  if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
    return { ok: false as const, error: "This link has expired" };
  }

  const signers = await pool.query(
    `SELECT contract_signer_id, full_name, email, status, signed_at,
            signature_typed_name, sort_order, intake_lead_id
     FROM workflow.contract_signer
     WHERE contract_package_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order`,
    [pkg.contract_package_id],
  );

  return {
    ok: true as const,
    package: {
      ...pkg,
      fee_pre_suit: Number(pkg.fee_pre_suit),
      fee_post_filing: Number(pkg.fee_post_filing),
      fee_appeal: Number(pkg.fee_appeal),
      body_hash: bodyHash(pkg.rendered_body ?? ""),
    },
    signers: signers.rows,
  };
}

export async function signContractAsPartyAction(input: {
  token: string;
  signerId: string;
  typedName: string;
  signatureData?: string | null;
  agree: boolean;
}): Promise<ActionResult> {
  try {
    if (!input.agree) {
      return { ok: false, error: "You must agree to the contract terms" };
    }
    if (!input.typedName.trim()) {
      return { ok: false, error: "Type your full legal name to sign" };
    }
    if (
      !input.signatureData?.startsWith("data:image/") ||
      input.signatureData.length < 200
    ) {
      return { ok: false, error: "Please draw your signature before signing" };
    }

    if (!getPgPool()) return { ok: false, error: "Signing unavailable" };

    const loaded = await getPublicContractByToken(input.token);
    if (!loaded.ok) return { ok: false, error: loaded.error };
    if (loaded.package.status === "executed" && loaded.package.artifact_pdf_base64) {
      return { ok: false, error: "Contract already fully executed" };
    }

    const signer = loaded.signers.find(
      (s: { contract_signer_id: string }) =>
        s.contract_signer_id === input.signerId,
    ) as
      | { contract_signer_id: string; status: string; full_name?: string }
      | undefined;
    if (!signer) return { ok: false, error: "Signer not found" };

    const actorId =
      (loaded.package.created_by as string | null | undefined) ||
      PORTAL_AUDIT_STAFF_ID;
    const packageId = String(loaded.package.contract_package_id);

    // Recovery: prior attempt may have stored the signature but failed filing PDF.
    if (signer.status === "signed") {
      const pending = loaded.signers.filter(
        (s: { status: string }) => s.status !== "signed",
      );
      if (pending.length === 0 && !loaded.package.artifact_pdf_base64) {
        await withPortalAuditTx(actorId, (client) =>
          finalizeExecutedPackagePg(client, packageId),
        );
        return {
          ok: true,
          message: "Signed — all parties complete. Contract filed.",
        };
      }
      const name = signer.full_name?.trim() || "This party";
      return {
        ok: false,
        error: `${name} already signed — pick another name from the list`,
      };
    }

    const h = headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = h.get("user-agent")?.slice(0, 500) ?? null;

    const result = await withPortalAuditTx(actorId, async (client) => {
      await client.query(
        `UPDATE workflow.contract_signer SET
           status = 'signed',
           signed_at = now(),
           signature_typed_name = $2,
           signature_data = $3,
           agree_attestation = true,
           ip_address = $4,
           user_agent = $5
         WHERE contract_signer_id = $1
           AND status <> 'signed'`,
        [
          input.signerId,
          input.typedName.trim(),
          input.signatureData?.slice(0, 200_000) || null,
          ip,
          ua,
        ],
      );

      const all = await client.query(
        `SELECT contract_signer_id, full_name, status, signed_at,
                signature_typed_name, intake_lead_id
         FROM workflow.contract_signer
         WHERE contract_package_id = $1 AND deleted_at IS NULL`,
        [packageId],
      );
      const pending = all.rows.filter(
        (s: { status: string }) => s.status !== "signed",
      );

      await client.query(
        `UPDATE workflow.contract_package SET status = 'partially_signed'
         WHERE contract_package_id = $1 AND status <> 'executed'`,
        [packageId],
      );

      await client.query(
        `INSERT INTO workflow.communication_log
           (intake_lead_id, channel, direction, summary)
         VALUES ($1, 'portal', 'inbound', $2)`,
        [
          loaded.package.primary_intake_lead_id,
          `Contract signed by ${input.typedName.trim()} (${pending.length} remaining)`,
        ],
      );

      if (pending.length === 0) {
        await finalizeExecutedPackagePg(client, packageId);
        return "complete" as const;
      }
      return "partial" as const;
    });

    if (result === "complete") {
      return {
        ok: true,
        message: "Signed — all parties complete. Contract filed.",
      };
    }

    return {
      ok: true,
      message: "Signed. Waiting on other parties.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function finalizeExecutedPackagePg(
  client: PoolClient,
  packageId: string,
) {
  const { rows: pkgs } = await client.query(
    `SELECT * FROM workflow.contract_package WHERE contract_package_id = $1`,
    [packageId],
  );
  const pkg = pkgs[0];
  if (!pkg) return;

  const { rows: signers } = await client.query(
    `SELECT * FROM workflow.contract_signer
     WHERE contract_package_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order`,
    [packageId],
  );

  const body = (pkg.rendered_body as string) ?? "";
  const pdf = await buildContractPdfBase64({
    body,
    signers: signers.map(
      (s: {
        full_name: string;
        signed_at: string | null;
        signature_typed_name: string | null;
        signature_data?: string | null;
      }) => ({
        full_name: s.full_name,
        signed_at: s.signed_at,
        signature_typed_name: s.signature_typed_name,
        signature_data: s.signature_data ?? null,
      }),
    ),
    firm: {
      signature_data: (pkg.firm_signature_data as string | null) ?? null,
      signature_typed_name:
        (pkg.firm_signature_typed_name as string | null) ?? null,
      signed_at: pkg.firm_signed_at
        ? String(pkg.firm_signed_at)
        : null,
    },
  });

  const html = `<pre style="white-space:pre-wrap;font-family:Times,serif">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  const leadIds = Array.from(
    new Set<string>([
      pkg.primary_intake_lead_id as string,
      ...signers
        .map((s: { intake_lead_id?: string | null }) => s.intake_lead_id)
        .filter((id): id is string => Boolean(id)),
    ]),
  );

  let primaryDocId: string | null =
    (pkg.primary_document_id as string | null) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const noteTag = `contract_package_id=${packageId}`;

  for (const leadId of leadIds) {
    const { rows: leads } = await client.query(
      `SELECT intake_lead_id, resulting_matter_id FROM core.intake_lead
       WHERE intake_lead_id = $1`,
      [leadId],
    );
    const lead = leads[0];
    const matterId = (lead?.resulting_matter_id as string | null) ?? null;

    await client.query(
      `INSERT INTO core.entity (entity_id, entity_type)
       VALUES ($1, 'intake_lead')
       ON CONFLICT (entity_id) DO NOTHING`,
      [leadId],
    );

    const { rows: existingDocs } = await client.query(
      `SELECT document_id FROM workflow.document
       WHERE entity_id = $1
         AND deleted_at IS NULL
         AND notes LIKE $2
       LIMIT 1`,
      [leadId, `${noteTag}%`],
    );

    let docId = (existingDocs[0]?.document_id as string | undefined) ?? null;
    if (!docId) {
      const { rows: docs } = await client.query(
        `INSERT INTO workflow.document (
           entity_id, client_matter_id, doc_type_code, title, direction,
           status, executed_date, sent_date, notes, hash_sha256
         ) VALUES (
           $1, $2, 'contract', 'Contingent Fee Contract (executed)', 'outbound',
           'executed', $3::date, $3::date, $4, $5
         ) RETURNING document_id`,
        [
          leadId,
          matterId,
          today,
          `${noteTag}; pdf_sha_prefix=${bodyHash(pdf).slice(0, 16)}`,
          bodyHash(pdf),
        ],
      );
      docId = docs[0]?.document_id as string;
    }
    if (docId && !primaryDocId) primaryDocId = docId;

    await client.query(
      `UPDATE core.intake_lead SET status = 'signed' WHERE intake_lead_id = $1`,
      [leadId],
    );

    if (matterId && docId) {
      const { rows: existingFee } = await client.query(
        `SELECT fee_agreement_id FROM finance.fee_agreement
         WHERE client_matter_id = $1
           AND notes LIKE $2
         LIMIT 1`,
        [matterId, `From contract package ${packageId}%`],
      );
      if (!existingFee[0]) {
        await client.query(
          `INSERT INTO finance.fee_agreement (
             client_matter_id, agreement_type, pct_pre_suit, pct_post_filing,
             pct_appeal, executed_date, document_id, notes
           ) VALUES ($1, 'contingency', $2, $3, $4, $5::date, $6, $7)`,
          [
            matterId,
            pkg.fee_pre_suit,
            pkg.fee_post_filing,
            pkg.fee_appeal,
            today,
            docId,
            `From contract package ${packageId}`,
          ],
        );
      }
    }
  }

  await client.query(
    `UPDATE workflow.contract_package SET
       status = 'executed',
       executed_at = now(),
       artifact_html = $2,
       artifact_pdf_base64 = $3,
       primary_document_id = $4
     WHERE contract_package_id = $1`,
    [packageId, html, pdf, primaryDocId],
  );

  await client.query(
    `INSERT INTO workflow.communication_log
       (intake_lead_id, channel, direction, summary)
     VALUES ($1, 'portal', 'outbound', $2)`,
    [
      pkg.primary_intake_lead_id,
      "Contract fully executed by all parties — PDF filed to lead/matter profile(s)",
    ],
  );
}
