"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  WHATS_NEW_ID,
  WHATS_NEW_ITEMS,
  WHATS_NEW_STORAGE_KEY,
  isExternalHref,
} from "@/lib/whatsNew";

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(WHATS_NEW_STORAGE_KEY) === "1") return;
      setOpen(true);
    } catch {
      /* private mode / blocked storage — skip */
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-panel border border-grid bg-surface p-6 shadow-soft">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          What’s new · {WHATS_NEW_ID}
        </p>
        <h2 id="whats-new-title" className="mt-1 text-xl font-bold text-ink">
          Review these updates
        </h2>
        <p className="mt-2 text-sm text-muted">
          Preview links open in a new tab. Dismiss once — you won’t see this
          again until the next release notes.
        </p>

        <ul className="mt-5 space-y-4">
          {WHATS_NEW_ITEMS.map((item) => (
            <li
              key={item.title}
              className="border-t border-grid pt-4 first:border-t-0 first:pt-0"
            >
              <h3 className="text-sm font-bold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
              {item.href ? (
                isExternalHref(item.href) ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismiss}
                    className="mt-2 inline-block text-xs font-semibold text-accent-dk hover:underline"
                  >
                    {item.hrefLabel ?? "Open"} →
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    onClick={dismiss}
                    className="mt-2 inline-block text-xs font-semibold text-accent-dk hover:underline"
                  >
                    {item.hrefLabel ?? "Open"} →
                  </Link>
                )
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg bg-accent-dk px-4 py-2.5 text-sm font-bold text-white hover:opacity-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
