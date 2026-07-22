import { notFound, redirect } from "next/navigation";
import { MatterDetailView } from "@/components/cases/MatterDetail";
import {
  getMatter,
  getMatterTeam,
  getPersonContacts,
  listAssignableCaseManagers,
  listClaims,
  listCompanionMatters,
  listContactHistory,
  listMatterTasks,
  listPinnedNotes,
  listTreatmentEpisodes,
} from "@/lib/cases/queries";
import {
  buildCoverageBoxes,
  listCoverageNa,
  listDemands,
  listNegotiations,
  listPdClaimsForIncident,
  listProviderDirectory,
  listRecordRequests,
} from "@/lib/cases/matterExtras";
import {
  listMatterAccessLog,
  listMatterDocuments,
} from "@/lib/documents/queries";
import { documentsEnabled } from "@/lib/documents/enabled";
import { getCurrentStaff } from "@/lib/staff-server";
import { createClient } from "@/lib/supabase/server";
import type { StalledRow } from "@/lib/cases/types";

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { focus?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const matter = await getMatter(params.id);
  if (!matter) notFound();

  const deepLinkCard = searchParams?.focus?.trim() || null;
  const showDocuments = documentsEnabled();

  const [
    team,
    contacts,
    phoneHistory,
    emailHistory,
    addressHistory,
    tasks,
    notes,
    episodes,
    claims,
    companions,
    pdClaims,
    naCats,
    recordRequests,
    demands,
    negotiations,
    providerDirectory,
    cmCandidates,
    documents,
    documentAccessLog,
  ] = await Promise.all([
    getMatterTeam(matter.client_matter_id),
    getPersonContacts(matter.client_person_id),
    listContactHistory(matter.client_person_id, "phone"),
    listContactHistory(matter.client_person_id, "email"),
    listContactHistory(matter.client_person_id, "address"),
    listMatterTasks(matter.client_matter_id),
    listPinnedNotes(matter.client_matter_id),
    listTreatmentEpisodes(matter.client_matter_id),
    listClaims(matter.client_matter_id),
    listCompanionMatters(matter.incident_group_id, matter.client_matter_id),
    listPdClaimsForIncident(matter.incident_group_id),
    listCoverageNa(matter.client_matter_id),
    listRecordRequests(matter.client_matter_id),
    listDemands(matter.client_matter_id),
    listNegotiations(matter.client_matter_id),
    listProviderDirectory(),
    listAssignableCaseManagers(),
    showDocuments
      ? listMatterDocuments(matter.client_matter_id)
      : Promise.resolve([]),
    showDocuments
      ? listMatterAccessLog(matter.client_matter_id)
      : Promise.resolve([]),
  ]);

  const address = contacts.address
    ? {
        address_line1: contacts.address.address_line1 ?? null,
        address_line2: contacts.address.address_line2 ?? null,
        city: contacts.address.city ?? null,
        state: contacts.address.state ?? null,
        zip: contacts.address.zip ?? null,
      }
    : null;

  const coverageBoxes = buildCoverageBoxes(episodes, naCats);

  const supabase = createClient();
  const { data: stalled } = await supabase
    .schema("workflow")
    .from("v_stalled_cases")
    .select("*")
    .eq("client_matter_id", matter.client_matter_id)
    .maybeSingle();

  const canSoftDelete =
    staff.is_attorney || staff.role_code === "admin";

  return (
    <MatterDetailView
      matter={matter}
      team={team}
      phone={contacts.phone?.phone ?? contacts.phone?.phone_e164 ?? null}
      email={contacts.email?.email ?? null}
      address={address}
      phoneHistory={phoneHistory as never}
      emailHistory={emailHistory as never}
      addressHistory={addressHistory as never}
      tasks={tasks}
      notes={notes}
      episodes={episodes}
      claims={claims}
      companions={
        companions as unknown as {
          client_matter_id: string;
          matter_number: string | null;
          current_stage_code: string;
          person: { first_name: string; last_name: string } | null;
        }[]
      }
      stalled={(stalled as StalledRow | null) ?? null}
      viewerRole={staff.role_code}
      viewerIsAttorney={staff.is_attorney}
      canSoftDelete={canSoftDelete}
      pdClaims={pdClaims}
      coverageBoxes={coverageBoxes}
      recordRequests={recordRequests}
      demands={demands}
      negotiations={negotiations}
      providerDirectory={providerDirectory}
      cmCandidates={cmCandidates}
      showDocuments={showDocuments}
      documents={documents}
      documentAccessLog={documentAccessLog}
      deepLinkCard={deepLinkCard}
    />
  );
}
