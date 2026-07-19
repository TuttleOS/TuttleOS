import { getPublicContractByToken } from "@/lib/contracts/actions";
import { PublicSignForm } from "@/components/contracts/PublicSignForm";
import {
  buildContractBodyHtml,
  buildMergeFields,
} from "@/lib/contracts/template";
import { formatDate } from "@/lib/dates";

export default async function PublicSignPage({
  params,
}: {
  params: { token: string };
}) {
  const loaded = await getPublicContractByToken(params.token);

  if (!loaded.ok) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-neutral-900">Contract unavailable</h1>
        <p className="mt-2 text-neutral-600">{loaded.error}</p>
      </main>
    );
  }

  const pkg = loaded.package;
  const merge = buildMergeFields({
    clientNames: String(pkg.client_display_names),
    location: String(pkg.incident_location),
    incidentDateDisplay: formatDate(String(pkg.incident_date)),
    causePhrase: String(pkg.cause_phrase ?? "car accident"),
    feePreSuit: Number(pkg.fee_pre_suit),
    feePostFiling: Number(pkg.fee_post_filing),
    feeAppeal: Number(pkg.fee_appeal),
  });
  const bodyHtml = buildContractBodyHtml(merge);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <PublicSignForm
        token={params.token}
        bodyHtml={bodyHtml}
        status={String(pkg.status)}
        signers={loaded.signers as never}
        fees={{
          pre: Number(pkg.fee_pre_suit),
          post: Number(pkg.fee_post_filing),
          appeal: Number(pkg.fee_appeal),
        }}
        meta={{
          names: String(pkg.client_display_names),
          location: String(pkg.incident_location),
          incidentDate: String(pkg.incident_date),
        }}
      />
    </main>
  );
}
