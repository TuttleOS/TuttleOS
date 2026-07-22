"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EMPTY_RELEASE_REVIEW,
  isExternalHref,
  releaseReviewStorageKey,
  type ReleaseReviewState,
  type ReleaseReviewVote,
  type VersionUpdate,
} from "@/lib/whatsNew";

const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 450_000;

function loadReview(releaseId: string): ReleaseReviewState {
  try {
    const raw = window.localStorage.getItem(releaseReviewStorageKey(releaseId));
    if (!raw) return { ...EMPTY_RELEASE_REVIEW };
    const parsed = JSON.parse(raw) as Partial<ReleaseReviewState>;
    return {
      vote: parsed.vote === "up" || parsed.vote === "down" ? parsed.vote : null,
      happy: Boolean(parsed.happy),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      screenshots: Array.isArray(parsed.screenshots)
        ? parsed.screenshots.filter(
            (s) =>
              s &&
              typeof s.name === "string" &&
              typeof s.dataUrl === "string",
          )
        : [],
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return { ...EMPTY_RELEASE_REVIEW };
  }
}

function saveReview(releaseId: string, state: ReleaseReviewState) {
  try {
    window.localStorage.setItem(
      releaseReviewStorageKey(releaseId),
      JSON.stringify(state),
    );
  } catch {
    /* quota / private mode */
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export function VersionUpdatesList({
  releases,
}: {
  releases: VersionUpdate[];
}) {
  return (
    <ol className="mt-8 space-y-8">
      {releases.map((release, index) => (
        <VersionUpdateCard
          key={release.id}
          release={release}
          isCurrent={index === 0}
        />
      ))}
    </ol>
  );
}

function VersionUpdateCard({
  release,
  isCurrent,
}: {
  release: VersionUpdate;
  isCurrent: boolean;
}) {
  const [review, setReview] = useState<ReleaseReviewState>({
    ...EMPTY_RELEASE_REVIEW,
  });
  const [shotErr, setShotErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReview(loadReview(release.id));
    setReady(true);
  }, [release.id]);

  function patch(next: Partial<ReleaseReviewState>) {
    setReview((prev) => {
      const merged: ReleaseReviewState = {
        ...prev,
        ...next,
        updatedAt: new Date().toISOString(),
      };
      saveReview(release.id, merged);
      return merged;
    });
  }

  function setVote(vote: ReleaseReviewVote) {
    patch({ vote: review.vote === vote ? null : vote });
  }

  async function onScreenshotsSelected(files: FileList | null) {
    setShotErr(null);
    if (!files?.length) return;
    const remaining = MAX_SHOTS - review.screenshots.length;
    if (remaining <= 0) {
      setShotErr(`Limit ${MAX_SHOTS} screenshots per release on this browser.`);
      return;
    }
    const chosen = Array.from(files).slice(0, remaining);
    const added: ReleaseReviewState["screenshots"] = [];
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        setShotErr("Screenshots must be image files (PNG, JPEG, WebP).");
        continue;
      }
      if (file.size > MAX_SHOT_BYTES) {
        setShotErr(
          `Skip ${file.name} — keep each shot under ~450 KB for browser storage.`,
        );
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        added.push({ name: file.name, dataUrl });
      } catch {
        setShotErr(`Could not read ${file.name}.`);
      }
    }
    if (added.length) {
      patch({ screenshots: [...review.screenshots, ...added] });
    }
  }

  return (
    <li className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">{release.title}</h2>
        <span className="text-xs font-semibold text-muted">
          {release.dateLabel}
          {isCurrent ? " · current" : ""}
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

      {release.howToTest && release.howToTest.length > 0 && (
        <div className="mt-5 rounded-lg border border-grid bg-page/60 px-4 py-3">
          <h3 className="text-sm font-bold text-ink">How to test</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            {release.howToTest.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-accent/25 bg-accent/5 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Your testing review</h3>
          {ready && review.updatedAt && (
            <span className="text-[10px] text-muted">
              Saved on this browser ·{" "}
              {new Date(review.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Feedback stays in your browser only (not shared to the firm DB yet).
          Use it while you walk the checklist; clear site data resets it.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Verdict</span>
          <button
            type="button"
            aria-pressed={review.vote === "up"}
            onClick={() => setVote("up")}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              review.vote === "up"
                ? "border-success bg-success-bg text-success"
                : "border-grid hover:bg-surface-2"
            }`}
          >
            👍 Thumbs up
          </button>
          <button
            type="button"
            aria-pressed={review.vote === "down"}
            onClick={() => setVote("down")}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              review.vote === "down"
                ? "border-danger bg-danger-bg text-danger"
                : "border-grid hover:bg-surface-2"
            }`}
          >
            👎 Thumbs down
          </button>
        </div>

        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-blue-700"
            checked={review.happy}
            onChange={(e) => patch({ happy: e.target.checked })}
          />
          <span>
            <span className="font-semibold text-ink">Happy with testing</span>
            <span className="block text-xs text-muted">
              Check when the how-to-test steps passed and you are ready for the
              next ship step.
            </span>
          </span>
        </label>

        <label className="mt-3 block text-xs font-semibold text-muted">
          Notes
          <textarea
            value={review.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={3}
            placeholder="What worked, what felt wrong, questions for eng…"
            className="mt-1 w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm font-normal text-ink"
          />
        </label>

        <div className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted">
              Screenshots ({review.screenshots.length}/{MAX_SHOTS})
            </span>
            <label className="cursor-pointer rounded-lg border border-grid px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
              Add screenshot
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void onScreenshotsSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {shotErr && (
            <p className="mt-1 text-xs font-semibold text-danger">{shotErr}</p>
          )}
          {review.screenshots.length > 0 && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {review.screenshots.map((shot, i) => (
                <li
                  key={`${shot.name}-${i}`}
                  className="overflow-hidden rounded-lg border border-grid bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.dataUrl}
                    alt={shot.name}
                    className="max-h-40 w-full object-contain bg-page"
                  />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] text-muted">
                    <span className="truncate">{shot.name}</span>
                    <button
                      type="button"
                      className="shrink-0 font-semibold text-danger hover:underline"
                      onClick={() =>
                        patch({
                          screenshots: review.screenshots.filter(
                            (_, idx) => idx !== i,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
