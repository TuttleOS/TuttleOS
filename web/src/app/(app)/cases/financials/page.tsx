import Link from "next/link";
import { redirect } from "next/navigation";
import { staffCanWriteFinance } from "@/lib/staff";
import { getStaffViewContext } from "@/lib/staff-view";

/**
 * Static route so /cases/financials is not captured by /cases/[id].
 * Finance UI is not shipped (Stage 4). Non-finance roles get a denial, not a crash.
 */
export default async function CasesFinancialsPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const allowed = staffCanWriteFinance(ctx.viewStaff);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-bold">Financials</h1>
        <div className="rounded-panel border border-grid bg-surface px-4 py-4 text-sm">
          <p className="font-semibold">Not permitted</p>
          <p className="mt-2 text-muted">
            Case-level financials are restricted to the finance tier (attorney
            and lien specialist). This is a deliberate refusal, not a missing
            page. Settlement and disbursement screens are not in the CM beta.
          </p>
        </div>
        <Link href="/cases" className="text-sm font-semibold text-accent-dk">
          ← Back to caseload
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Financials</h1>
      <div className="rounded-panel border border-warning/40 bg-warning-bg/40 px-4 py-4 text-sm">
        <p className="font-semibold">Finance UI not shipped yet.</p>
        <p className="mt-2">
          You hold the finance data tier, but settlement → trust → disbursement
          screens are blocked until Stage 4. Use the liens worklist for the
          current skeleton.
        </p>
      </div>
      <Link href="/liens" className="text-sm font-semibold text-accent-dk">
        → Liens worklist
      </Link>
    </div>
  );
}
