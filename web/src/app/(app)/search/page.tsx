import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();

  let people: {
    person_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
  }[] = [];

  if (q) {
    const { data } = await supabase
      .schema("core")
      .from("person")
      .select("person_id, first_name, last_name, date_of_birth")
      .or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%`)
      .is("deleted_at", null)
      .limit(50);
    people = data ?? [];
  }

  return (
    <section className="rounded-panel border border-grid bg-surface p-6 shadow-soft">
      <h1 className="text-2xl font-bold">Search results</h1>
      <p className="mt-1 text-muted">
        {q ? (
          <>
            Query: <strong className="text-ink">{q}</strong>
          </>
        ) : (
          "Enter a query in the global search bar."
        )}
      </p>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted">
        Cases & Clients
      </h2>
      <ul className="mt-2 divide-y divide-grid border-t border-grid">
        {people.length === 0 ? (
          <li className="py-3 text-muted">No client matches</li>
        ) : (
          people.map((p) => (
            <li key={p.person_id} className="flex items-center justify-between py-3">
              <Link href="/cases" className="font-semibold text-accent-dk no-underline hover:underline">
                {p.last_name}, {p.first_name}
              </Link>
              <span className="text-muted">
                {p.date_of_birth ? `DOB ${formatDate(p.date_of_birth)}` : "—"}
              </span>
            </li>
          ))
        )}
      </ul>
      <p className="mt-4 text-xs text-muted">
        Grouped categories (providers, adjusters, counsel, etc.) expand in later
        phases. Results respect RLS automatically.
      </p>
    </section>
  );
}
