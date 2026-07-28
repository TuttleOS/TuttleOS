import Link from "next/link";

export type AttentionNoticeTone = "warn" | "crit" | "info";

export type AttentionNoticeCard = {
  key: string;
  category: string;
  tone: AttentionNoticeTone;
  title: string;
  body: string;
  meta: string;
  href: string;
};

function toneDot(tone: AttentionNoticeTone): string {
  if (tone === "crit") return "bg-danger";
  if (tone === "warn") return "bg-warning";
  return "bg-accent";
}

function toneText(tone: AttentionNoticeTone): string {
  if (tone === "crit") return "text-danger";
  if (tone === "warn") return "text-warning";
  return "text-accent-dk";
}

/**
 * Attorney-style story cards for role dashboards.
 * Same visual language as Owner “Needs attention”; content is role-scoped.
 */
export function RoleAttentionNotices({
  title = "Needs attention",
  subtitle,
  cards,
  emptyHint = "Nothing urgent in your queue right now.",
  primaryCta,
}: {
  title?: string;
  subtitle?: string;
  cards: AttentionNoticeCard[];
  emptyHint?: string;
  primaryCta?: { href: string; label: string };
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        {primaryCta ? (
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-dk px-3.5 py-2 text-xs font-semibold text-white no-underline shadow-soft transition hover:opacity-95"
          >
            {primaryCta.label}
          </Link>
        ) : null}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-grid/70 bg-surface px-5 py-8 text-center text-sm text-muted shadow-soft">
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.key}
              className="flex flex-col rounded-2xl border border-grid/60 bg-surface p-5 shadow-soft"
            >
              <div
                className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] ${toneText(card.tone)}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${toneDot(card.tone)}`}
                />
                {card.category}
              </div>
              <h3 className="mt-3 text-base font-semibold leading-snug text-ink">
                {card.title}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
                {card.body}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted">{card.meta}</span>
                <Link
                  href={card.href}
                  className="text-sm font-semibold text-accent-dk no-underline hover:underline"
                >
                  Open →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
