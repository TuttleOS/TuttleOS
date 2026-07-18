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
import { getCurrentStaff } from "@/lib/staff-server";

export default async function LitigationMatterPage({
  params,
}: {
  params: { id: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const matter = await getMatter(params.id);
  if (!matter) notFound();

  const [team, contacts, court, deadlines, tasks, notes] = await Promise.all([
    getMatterTeam(matter.client_matter_id),
    getPersonContacts(matter.client_person_id),
    getCourtCase(matter.client_matter_id),
    listMatterDeadlines(matter.client_matter_id),
    listMatterTasks(matter.client_matter_id),
    listPinnedNotes(matter.client_matter_id),
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
    />
  );
}
