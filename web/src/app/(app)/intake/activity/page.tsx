import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/dates";
import { getCurrentStaff } from "@/lib/staff-server";
import { leadDisplayName } from "@/lib/intake/display";
import { getLead, listMyIntakeActivity } from "@/lib/intake/queries";

export default async function IntakeActivityPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const rows = await listMyIntakeActivity(staff.staff_id);
  const withNames = await Promise.all(
    rows.map(async (r) => {
      const lead = r.intake_lead_id ? await getLead(r.intake_lead_id) : null;
      return {
        ...r,
        client: lead ? leadDisplayName(lead) : "Lead",
      };
    }),
  );

  return (
    <section className="rounded-panel border border-grid bg-surface shadow-soft">
      <div className="border-b border-grid px-5 py-4">
        <h1 className="text-xl font-bold">My Activity</h1>
        <p className="text-sm text-muted">
          Newest first. Interrupted? Pick up at the top.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-grid text-xs text-muted">
            <th className="px-5 py-2 font-semibold">When</th>
            <th className="px-5 py-2 font-semibold">Lead</th>
            <th className="px-5 py-2 font-semibold">What I did</th>
            <th className="px-5 py-2 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {withNames.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-muted">
                No intake activity yet.
              </td>
            </tr>
          ) : (
            withNames.map((a, i) => (
              <tr
                key={a.communication_log_id}
                className={`border-b border-grid ${i === 0 ? "bg-accent-lt/40" : ""}`}
              >
                <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                  {formatDateTime(a.occurred_at)}
                  {i === 0 && (
                    <div className="mt-1">
                      <span className="rounded-md bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info">
                        ⟵ left off here
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  {a.intake_lead_id ? (
                    <Link
                      href={`/intake/leads/${a.intake_lead_id}`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      {a.client}
                    </Link>
                  ) : (
                    a.client
                  )}
                </td>
                <td className="px-5 py-3 text-[13px]">{a.summary}</td>
                <td className="px-5 py-3">
                  {i === 0 && a.intake_lead_id && (
                    <Link
                      href={`/intake/leads/${a.intake_lead_id}`}
                      className="rounded-lg bg-accent-dk px-3 py-1.5 text-xs font-bold text-white no-underline"
                    >
                      Resume →
                    </Link>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
