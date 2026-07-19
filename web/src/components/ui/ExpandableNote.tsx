"use client";

import { useState } from "react";

const DEFAULT_CHARS = 180;

/** CasePeer-style truncate with expand; full text always retained. */
export function ExpandableNote({
  text,
  maxChars = DEFAULT_CHARS,
}: {
  text: string;
  maxChars?: number;
}) {
  const [open, setOpen] = useState(false);
  const body = text ?? "";
  const needsTruncation = body.length > maxChars;

  if (!needsTruncation) {
    return <p className="whitespace-pre-wrap text-sm text-ink">{body}</p>;
  }

  const preview = body.slice(0, maxChars).trimEnd();

  return (
    <div className="text-sm text-ink">
      <p className="whitespace-pre-wrap">
        {open ? body : `${preview}…`}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 text-xs font-semibold text-accent-dk hover:underline"
      >
        {open ? "Show less" : "More"}
      </button>
    </div>
  );
}
