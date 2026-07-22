"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EMPTY_ITEM_REVIEW,
  EMPTY_RELEASE_REVIEW,
  isExternalHref,
  releaseReviewStorageKey,
  type ItemReviewState,
  type ReleaseReviewState,
  type ReleaseReviewVote,
  type TestingGuide,
  type VersionUpdate,
} from "@/lib/whatsNew";

const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 450_000;

function loadReview(releaseId: string): ReleaseReviewState {
  try {
    const raw = window.localStorage.getItem(releaseReviewStorageKey(releaseId));
    if (!raw) return { ...EMPTY_RELEASE_REVIEW, items: {} };
    const parsed = JSON.parse(raw) as Partial<ReleaseReviewState>;
    const items: Record<string, ItemReviewState> = {};
    if (parsed.items && typeof parsed.items === "object") {
      for (const [key, val] of Object.entries(parsed.items)) {
        if (!val || typeof val !== "object") continue;
        items[key] = {
          vote:
            val.vote === "up" || val.vote === "down" ? val.vote : null,
          notes: typeof val.notes === "string" ? val.notes : "",
        };
      }
    }
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
      items,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return { ...EMPTY_RELEASE_REVIEW, items: {} };
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

function TestingGuidePanel({ guide }: { guide: TestingGuide }) {
  const steps = guide.walkthrough ?? [];
  return (
    <div className="mt-5 space-y-4 rounded-lg border border-grid bg-page/60 px-4 py-4">
      <div>
        <h3 className="text-sm font-bold text-ink">Testing guide</h3>
        {guide.statusNote && (
          <p className="mt-1 text-sm text-muted">{guide.statusNote}</p>
        )}
      </div>

      {guide.liveVsPreview && guide.liveVsPreview.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
            Live vs preview
          </h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted">
            {guide.liveVsPreview.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {(guide.queuesIntro || (guide.queues && guide.queues.length > 0)) && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
            What each queue does
          </h4>
          {guide.queuesIntro && (
            <p className="mt-1.5 text-sm text-muted">{guide.queuesIntro}</p>
          )}
          {guide.queues && guide.queues.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-grid bg-surface">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-grid text-muted">
                    <th className="px-3 py-2 font-semibold">Queue</th>
                    <th className="px-3 py-2 font-semibold">Shows</th>
                    <th className="px-3 py-2 font-semibold">Opens</th>
                    <th className="px-3 py-2 font-semibold">Leaves when…</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.queues.map((row) => (
                    <tr key={row.queue} className="border-b border-grid last:border-0">
                      <td className="px-3 py-2 font-semibold text-ink">
                        {row.queue}
                      </td>
                      <td className="px-3 py-2 text-muted">{row.shows}</td>
                      <td className="px-3 py-2 text-muted">{row.opens}</td>
                      <td className="px-3 py-2 text-muted">{row.clearsWhen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {guide.rules && guide.rules.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {guide.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      )}

      {steps.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
            {guide.walkthroughTitle ?? "Walkthrough"}
          </h4>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {guide.afterHappy && (
        <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-ink">
          {guide.afterHappy}
        </p>
      )}
    </div>
  );
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

  function patchItem(title: string, next: Partial<ItemReviewState>) {
    setReview((prev) => {
      const current = prev.items[title] ?? { ...EMPTY_ITEM_REVIEW };
      const merged: ReleaseReviewState = {
        ...prev,
        items: {
          ...prev.items,
          [title]: { ...current, ...next },
        },
        updatedAt: new Date().toISOString(),
      };
      saveReview(release.id, merged);
      return merged;
    });
  }

  function setItemVote(title: string, vote: ReleaseReviewVote) {
    setReview((prev) => {
      const current = prev.items[title] ?? { ...EMPTY_ITEM_REVIEW };
      const merged: ReleaseReviewState = {
        ...prev,
        items: {
          ...prev.items,
          [title]: {
            ...current,
            vote: current.vote === vote ? null : vote,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      saveReview(release.id, merged);
      return merged;
    });
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

      <ul className="mt-4 space-y-4 border-t border-grid pt-4">
        {release.items.map((item) => {
          const itemReview = review.items[item.title] ?? EMPTY_ITEM_REVIEW;
          return (
            <li
              key={item.title}
              className="rounded-lg border border-grid bg-page/40 px-3 py-3"
            >
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

              <div className="mt-3 border-t border-grid/80 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Test this
                  </span>
                  <button
                    type="button"
                    aria-pressed={itemReview.vote === "up"}
                    onClick={() => setItemVote(item.title, "up")}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      itemReview.vote === "up"
                        ? "border-success bg-success-bg text-success"
                        : "border-grid bg-surface hover:bg-surface-2"
                    }`}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    aria-pressed={itemReview.vote === "down"}
                    onClick={() => setItemVote(item.title, "down")}
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      itemReview.vote === "down"
                        ? "border-danger bg-danger-bg text-danger"
                        : "border-grid bg-surface hover:bg-surface-2"
                    }`}
                  >
                    👎
                  </button>
                </div>
                <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Notes
                  <textarea
                    value={itemReview.notes}
                    onChange={(e) =>
                      patchItem(item.title, { notes: e.target.value })
                    }
                    rows={2}
                    placeholder="Notes for this item…"
                    className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {release.testingGuide ? (
        <TestingGuidePanel guide={release.testingGuide} />
      ) : release.howToTest && release.howToTest.length > 0 ? (
        <div className="mt-5 rounded-lg border border-grid bg-page/60 px-4 py-3">
          <h3 className="text-sm font-bold text-ink">How to test</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            {release.howToTest.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-accent/25 bg-accent/5 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Overall testing review</h3>
          {ready && (
            <span className="text-[10px] font-semibold text-muted">
              {review.updatedAt
                ? `Autosaved · ${new Date(review.updatedAt).toLocaleString()}`
                : "Autosaves as you go"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Changes autosave in this browser only (not the firm database yet). No
          Save button needed — per-item thumbs/notes above, plus this overall
          verdict, stick as soon as you change them. Clearing site data resets
          this review.
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
