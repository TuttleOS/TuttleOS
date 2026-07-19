import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchMattersByQuery } from "@/lib/search/matterSearch";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();

  let hits: Awaited<ReturnType<typeof searchMattersByQuery>> = [];
  let error: string | null = null;
  if (q) {
    try {
      hits = await searchMattersByQuery(supabase, q, 50);
    } catch (e) {
      error = e instanceof Error ? e.message : "Search failed";
    }
  }

  return (
    <section className="rounded-panel border border-grid bg-surface p-6 shadow-soft">
      <h1 className="text-2xl font-bold">Search results</h1>
      <p className="mt-1 text-muted">
        {q ? (
          <>
            Query: <strong className="text-ink">{q}</strong> — cases open in Case
            Manager view
          </>
        ) : (
          "Enter a query in the global search bar."
        )}
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted">
        Cases
      </h2>
      <ul className="mt-2 divide-y divide-grid border-t border-grid">
        {hits.length === 0 ? (
          <li className="py-3 text-muted">No case matches</li>
        ) : (
          hits.map((h) => (
            <li
              key={h.client_matter_id}
              className="flex items-center justify-between py-3"
            >
              <Link
                href={h.href}
                className="font-semibold text-accent-dk no-underline hover:underline"
              >
                {h.label}
              </Link>
              <span className="text-muted">{h.sub}</span>
            </li>
          ))
        )}
      </ul>
      <p className="mt-4 text-xs text-muted">
        Results list matters (client + DOI). Multi-case clients appear once per
        matter. Providers / adjusters expand in later phases.
      </p>
    </section>
  );
}
