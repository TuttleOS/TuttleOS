"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  searchMattersByQuery,
  type MatterSearchHit,
} from "@/lib/search/matterSearch";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<MatterSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      setOpen(false);
      setErr(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const supabase = createClient();
        const next = await searchMattersByQuery(supabase, q.trim(), 8);
        if (cancelled) return;
        setHits(next);
        setOpen(true);
      } catch (e) {
        if (cancelled) return;
        setHits([]);
        setErr(e instanceof Error ? e.message : "Search failed");
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setOpen(false);
            if (hits[0]) {
              router.push(hits[0].href);
            } else {
              router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search clients, cases, phones, claim #…"
        className="h-11 w-full rounded-full border border-grid/80 bg-surface px-5 pr-14 text-ink shadow-soft outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        aria-label="Global search"
        autoComplete="off"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-grid bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
        ⌘K
      </span>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-[10px] border border-grid bg-surface shadow-soft">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            {loading ? "Searching…" : "Cases"}
          </div>
          {err && (
            <div className="px-3 py-2 text-sm text-danger">{err}</div>
          )}
          {!err && hits.length === 0 && !loading ? (
            <div className="px-3 py-3 text-sm text-muted">No matches</div>
          ) : (
            hits.map((h) => (
              <button
                key={h.client_matter_id}
                type="button"
                className="flex w-full items-center justify-between gap-4 border-t border-grid px-3 py-2.5 text-left hover:bg-surface-2"
                onClick={() => {
                  setOpen(false);
                  router.push(h.href);
                }}
              >
                <strong className="text-accent-dk">{h.label}</strong>
                <span className="whitespace-nowrap text-muted">{h.sub}</span>
              </button>
            ))
          )}
          <button
            type="button"
            className="w-full border-t border-grid px-3 py-2.5 text-left text-sm font-semibold text-accent-dk hover:bg-surface-2"
            onClick={() => {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            See all results for “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
