import { notFound, redirect } from "next/navigation";
import { ContractStaffView } from "@/components/contracts/ContractStaffView";
import { getContractPackageForStaffView } from "@/lib/contracts/queries";
import {
  buildContractBodyHtml,
  buildMergeFields,
} from "@/lib/contracts/template";
import { formatDate } from "@/lib/dates";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function StaffContractViewPage({
  params,
}: {
  params: { packageId: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const pkg = await getContractPackageForStaffView(params.packageId);
  if (!pkg) notFound();

  const merge = buildMergeFields({
    clientNames: pkg.client_display_names,
    location: pkg.incident_location,
    incidentDateDisplay: formatDate(pkg.incident_date),
    causePhrase: pkg.cause_phrase || "car accident",
    feePreSuit: pkg.fee_pre_suit,
    feePostFiling: pkg.fee_post_filing,
    feeAppeal: pkg.fee_appeal,
  });

  const canFirmSign = staff.is_attorney || staff.role_code === "admin";

  return (
    <main className="min-h-screen bg-neutral-100 print:bg-white">
      <ContractStaffView
        leadId={pkg.primary_intake_lead_id}
        packageId={pkg.contract_package_id}
        bodyHtml={buildContractBodyHtml(merge)}
        status={pkg.status}
        hasPdf={Boolean(pkg.has_pdf)}
        signers={pkg.signers}
        fees={{
          pre: pkg.fee_pre_suit,
          post: pkg.fee_post_filing,
          appeal: pkg.fee_appeal,
        }}
        meta={{
          names: pkg.client_display_names,
          location: pkg.incident_location,
          incidentDate: pkg.incident_date,
        }}
        firm={
          pkg.firm_signed_at
            ? {
                signature_data: pkg.firm_signature_data ?? null,
                typed_name: pkg.firm_signature_typed_name ?? null,
                signed_at: pkg.firm_signed_at ?? null,
              }
            : null
        }
        canFirmSign={canFirmSign}
      />
    </main>
  );
}
