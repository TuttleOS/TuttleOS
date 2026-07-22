import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/intake/LeadDetail";
import {
  getLead,
  getPersonContacts,
  listCompanionLeadsForGroup,
  listLeadAttempts,
} from "@/lib/intake/queries";
import { listContactHistory } from "@/lib/cases/queries";
import {
  getActivePackageForLead,
  listCompanionLeadOptions,
} from "@/lib/contracts/queries";
import { resolveLeadContractPlan } from "@/lib/contracts/plan";
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
  let address: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null = null;
  let phoneHistory: Awaited<ReturnType<typeof listContactHistory>> = [];
  let emailHistory: Awaited<ReturnType<typeof listContactHistory>> = [];
  let addressHistory: Awaited<ReturnType<typeof listContactHistory>> = [];

  if (lead.person_id) {
    const contacts = await getPersonContacts(lead.person_id);
    phone = contacts.phone?.phone ?? phone;
    email = contacts.email?.email ?? email;
    if (contacts.address) {
      address = {
        address_line1: contacts.address.address_line1 ?? null,
        address_line2: contacts.address.address_line2 ?? null,
        city: contacts.address.city ?? null,
        state: contacts.address.state ?? null,
        zip: contacts.address.zip ?? null,
      };
    }
    [phoneHistory, emailHistory, addressHistory] = await Promise.all([
      listContactHistory(lead.person_id, "phone"),
      listContactHistory(lead.person_id, "email"),
      listContactHistory(lead.person_id, "address"),
    ]);
  }

  let nextFriend: {
    person_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null = null;
  if (lead.next_friend_person_id) {
    const nfRaw = lead.next_friend as
      | { person_id: string; first_name: string; last_name: string }
      | { person_id: string; first_name: string; last_name: string }[]
      | null
      | undefined;
    const nf = Array.isArray(nfRaw) ? nfRaw[0] : nfRaw;
    if (nf) {
      const nfContacts = await getPersonContacts(lead.next_friend_person_id);
      nextFriend = {
        person_id: nf.person_id,
        full_name: `${nf.first_name} ${nf.last_name}`.trim(),
        email: nfContacts.email?.email ?? null,
        phone:
          nfContacts.phone?.phone ?? nfContacts.phone?.phone_e164 ?? null,
      };
    }
  }

  const [attempts, contractPackage, companionOptions, crashCompanions, contractPlan] =
    await Promise.all([
      listLeadAttempts(lead.intake_lead_id),
      getActivePackageForLead(lead.intake_lead_id),
      listCompanionLeadOptions(lead.intake_lead_id),
      lead.incident_group_id
        ? listCompanionLeadsForGroup(
            lead.incident_group_id,
            lead.intake_lead_id,
          )
        : Promise.resolve([]),
      resolveLeadContractPlan(lead, nextFriend?.full_name ?? null),
    ]);

  const canSoftDelete =
    !!staff && (staff.is_attorney || staff.role_code === "admin");

  const confirmHint =
    lead.person?.last_name ||
    leadDisplayName(lead).trim().split(/\s+/).filter(Boolean).at(-1) ||
    "LASTNAME";

  const locationGuess =
    (lead.description ?? "")
      .split("\n")
      .filter((l) => !l.startsWith("[in-person"))
      .join(" ")
      .trim() || "San Antonio";

  return (
    <LeadDetail
      lead={lead}
      phone={phone}
      email={email}
      address={address}
      attempts={attempts}
      phoneHistory={phoneHistory as never}
      emailHistory={emailHistory as never}
      addressHistory={addressHistory as never}
      canSoftDelete={canSoftDelete}
      deleteConfirmHint={confirmHint}
      contractPackage={contractPackage}
      companionOptions={companionOptions}
      crashCompanions={crashCompanions}
      locationGuess={locationGuess}
      nextFriend={nextFriend}
      contractPlan={contractPlan}
    />
  );
}
