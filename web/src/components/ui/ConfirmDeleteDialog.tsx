"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConfirmDeleteDialog({
  title,
  entityLabel,
  confirmHint,
  onConfirm,
  redirectTo,
}: {
  title: string;
  entityLabel: string;
  /** What the user must type (surname or matter #). */
  confirmHint: string;
  onConfirm: (
    confirmText: string,
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setErr(null);
    start(async () => {
      const res = await onConfirm(text);
      if (!res.ok) {
        setErr(res.error ?? "Delete failed");
        return;
      }
      setOpen(false);
      setText("");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
          setText("");
        }}
        className="rounded-lg border border-danger/50 bg-danger-bg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-danger hover:bg-danger/10"
      >
        Soft-delete {entityLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="w-full max-w-md rounded-panel border border-danger/40 bg-surface p-5 shadow-soft">
            <h2
              id="confirm-delete-title"
              className="text-lg font-bold text-danger"
            >
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted">
              This soft-deletes the record (recoverable). Type{" "}
              <span className="font-semibold text-ink">{confirmHint}</span> to
              confirm.
            </p>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-3 w-full rounded-lg border border-danger/40 bg-page px-3 py-2 text-sm"
              placeholder={confirmHint}
              disabled={pending}
            />
            {err ? (
              <p className="mt-2 text-sm font-semibold text-danger">{err}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-grid px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={submit}
                className="rounded-lg border border-danger bg-danger px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Confirm delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
