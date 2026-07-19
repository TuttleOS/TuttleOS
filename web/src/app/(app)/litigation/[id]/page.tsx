import { notFound, redirect } from "next/navigation";
import { LitMatterDetail } from "@/components/litigation/LitMatterDetail";
import {
  getCourtCase,
  getMatter,
  getMatterTeam,
  getPersonContacts,
  listMatterDeadlines,
  listMatterTasks,
  listPinnedNotes,
} from "@/lib/litigation/queries";
import { listAssignableCaseManagers, listCompanionMatters } from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { litMilestonesOnly } from "@/lib/workspace";

export default async function LitigationMatterPage({
  params,
}: {
  params: { id: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const matter = await getMatter(params.id);
  if (!matter) notFound();

  const [team, contacts, court, deadlines, tasks, notes, cmCandidates, companions] =
    await Promise.all([
      getMatterTeam(matter.client_matter_id),
      getPersonContacts(matter.client_person_id),
      getCourtCase(matter.client_matter_id),
      listMatterDeadlines(matter.client_matter_id),
      listMatterTasks(matter.client_matter_id),
      listPinnedNotes(matter.client_matter_id),
      listAssignableCaseManagers(),
      listCompanionMatters(matter.incident_group_id, matter.client_matter_id),
    ]);

  return (
    <LitMatterDetail
      matter={matter}
      team={team}
      phone={contacts.phone?.phone ?? contacts.phone?.phone_e164 ?? null}
      email={contacts.email?.email ?? null}
      court={court}
      deadlines={deadlines}
      tasks={tasks}
      notes={notes}
      viewerRole={staff.role_code}
      viewerIsAttorney={staff.is_attorney}
      cmCandidates={cmCandidates}
      companions={
        companions as unknown as {
          client_matter_id: string;
          matter_number: string | null;
          current_stage_code: string;
          person: { first_name: string; last_name: string } | null;
          copy_sharing_allowed?: boolean;
        }[]
      }
      milestonesOnly={litMilestonesOnly(staff.role_code)}
    />
  );
}
