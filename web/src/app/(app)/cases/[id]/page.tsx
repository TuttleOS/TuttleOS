import { notFound, redirect } from "next/navigation";
import { MatterDetailView } from "@/components/cases/MatterDetail";
import {
  getMatter,
  getMatterTeam,
  getPersonContacts,
  listClaims,
  listCompanionMatters,
  listMatterTasks,
  listPinnedNotes,
  listTreatmentEpisodes,
} from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { createClient } from "@/lib/supabase/server";
import type { StalledRow } from "@/lib/cases/types";

export default async function MatterPage({
  params,
}: {
  params: { id: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const matter = await getMatter(params.id);
  if (!matter) notFound();

  const [team, contacts, tasks, notes, episodes, claims, companions] =
    await Promise.all([
      getMatterTeam(matter.client_matter_id),
      getPersonContacts(matter.client_person_id),
      listMatterTasks(matter.client_matter_id),
      listPinnedNotes(matter.client_matter_id),
      listTreatmentEpisodes(matter.client_matter_id),
      listClaims(matter.client_matter_id),
      listCompanionMatters(matter.incident_group_id, matter.client_matter_id),
    ]);

  const supabase = createClient();
  const { data: stalled } = await supabase
    .schema("workflow")
    .from("v_stalled_cases")
    .select("*")
    .eq("client_matter_id", matter.client_matter_id)
    .maybeSingle();

  return (
    <MatterDetailView
      matter={matter}
      team={team}
      phone={contacts.phone?.phone ?? contacts.phone?.phone_e164 ?? null}
      email={contacts.email?.email ?? null}
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
    />
  );
}
