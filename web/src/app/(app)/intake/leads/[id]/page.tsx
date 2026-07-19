import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/intake/LeadDetail";
import {
  getLead,
  getPersonContacts,
  listLeadAttempts,
} from "@/lib/intake/queries";
import { listContactHistory } from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { leadDisplayName } from "@/lib/intake/display";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLead(params.id);
  if (!lead) notFound();

  const staff = await getCurrentStaff();

  let phone: string | null = lead.raw_phone;
  let email: string | null = lead.raw_email;
  let phoneHistory: Awaited<ReturnType<typeof listContactHistory>> = [];
  let emailHistory: Awaited<ReturnType<typeof listContactHistory>> = [];

  if (lead.person_id) {
    const contacts = await getPersonContacts(lead.person_id);
    phone = contacts.phone?.phone ?? phone;
    email = contacts.email?.email ?? email;
    [phoneHistory, emailHistory] = await Promise.all([
      listContactHistory(lead.person_id, "phone"),
      listContactHistory(lead.person_id, "email"),
    ]);
  }
  const attempts = await listLeadAttempts(lead.intake_lead_id);

  const canSoftDelete =
    !!staff && (staff.is_attorney || staff.role_code === "admin");

  const confirmHint =
    lead.person?.last_name ||
    leadDisplayName(lead).trim().split(/\s+/).filter(Boolean).at(-1) ||
    "LASTNAME";

  return (
    <LeadDetail
      lead={lead}
      phone={phone}
      email={email}
      attempts={attempts}
      phoneHistory={phoneHistory as never}
      emailHistory={emailHistory as never}
      canSoftDelete={canSoftDelete}
      deleteConfirmHint={confirmHint}
    />
  );
}
