import Link from "next/link";
import { VERSION_UPDATES, isExternalHref } from "@/lib/whatsNew";

export default function VersionUpdatesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">Version updates</h1>
      <p className="mt-2 text-sm text-muted">
        Release notes for recent Tuttle OS changes. The same list powers the
        login What’s New popup (shown once per release).
      </p>

      <ol className="mt-8 space-y-8">
        {VERSION_UPDATES.map((release, index) => (
          <li
            key={release.id}
            className="rounded-panel border border-grid bg-surface p-5 shadow-soft"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">{release.title}</h2>
              <span className="text-xs font-semibold text-muted">
                {release.dateLabel}
                {index === 0 ? " · current" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{release.summary}</p>
            <p className="mt-2 font-mono text-[10px] text-muted">{release.id}</p>
            <ul className="mt-4 space-y-3 border-t border-grid pt-4">
              {release.items.map((item) => (
                <li key={item.title}>
                  <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{item.body}</p>
                  {item.href ? (
                    isExternalHref(item.href) ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-accent-dk hover:underline"
                      >
                        {item.hrefLabel ?? "Open"} →
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="mt-1 inline-block text-xs font-semibold text-accent-dk hover:underline"
                      >
                        {item.hrefLabel ?? "Open"} →
                      </Link>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
