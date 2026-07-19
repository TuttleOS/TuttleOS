"use client";

import { useState } from "react";

type Kind = "email" | "phone";

/**
 * Contact value: primary click copies; optional secondary open (mailto/tel).
 * Michael: web Gmail — don't force mailto as the only action.
 */
export function CopyContact({
  value,
  kind,
}: {
  value: string;
  kind: Kind;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const openHref = kind === "email" ? `mailto:${value}` : `tel:${value}`;
  const openLabel = kind === "email" ? "Open in mail" : "Call";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        aria-label={`Copy ${kind} ${value}`}
        className="inline-flex items-center gap-1.5 text-accent-dk"
      >
        <span className="underline underline-offset-2">{value}</span>
        {copied && (
          <span className="text-xs font-semibold text-success no-underline">
            Copied
          </span>
        )}
      </button>
      <a
        href={openHref}
        className="text-[11px] font-semibold text-muted no-underline hover:text-accent-dk hover:underline"
        title={openLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "email" ? "Mail" : "Call"}
      </a>
    </span>
  );
}

/** @deprecated Prefer CopyContact — kept for existing imports */
export function CopyEmail({ email }: { email: string }) {
  return <CopyContact value={email} kind="email" />;
}
