import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/intake/LeadDetail";
import {
  getLead,
  getPersonContacts,
  listLeadAttempts,
} from "@/lib/intake/queries";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLead(params.id);
  if (!lead) notFound();

  let phone: string | null = lead.raw_phone;
  let email: string | null = lead.raw_email;
  if (lead.person_id) {
    const contacts = await getPersonContacts(lead.person_id);
    phone = contacts.phone?.phone ?? phone;
    email = contacts.email?.email ?? email;
  }
  const attempts = await listLeadAttempts(lead.intake_lead_id);

  return (
    <LeadDetail
      lead={lead}
      phone={phone}
      email={email}
      attempts={attempts}
    />
  );
}
