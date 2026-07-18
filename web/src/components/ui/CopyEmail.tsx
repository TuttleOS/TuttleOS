"use client";

import { useState } from "react";

/** Click copies email to clipboard (no mailto). */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for older browsers / denied permission
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy"
      aria-label={`Copy email ${email}`}
      className="inline-flex items-center gap-1.5 text-accent-dk underline-offset-2 hover:underline"
    >
      <span className="underline">{email}</span>
      {copied && (
        <span className="text-xs font-semibold text-success no-underline">
          Copied
        </span>
      )}
    </button>
  );
}
