"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  OUT_OF_SCOPE,
  TEST_NOTES_META,
  TEST_PREFLIGHT,
  TEST_SECTIONS,
  STORAGE_KEY,
  emptyTestNotesState,
  type StepResult,
  type TestNotesState,
  type TestStep,
} from "@/lib/owner/testNotes";

function loadState(): TestNotesState {
  if (typeof window === "undefined") return emptyTestNotesState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyTestNotesState();
    return { ...emptyTestNotesState(), ...JSON.parse(raw) } as TestNotesState;
  } catch {
    return emptyTestNotesState();
  }
}

function ResultRadios({
  name,
  value,
  onChange,
}: {
  name: string;
  value: StepResult;
  onChange: (v: StepResult) => void;
}) {
  const opts: { v: StepResult; label: string }[] = [
    { v: "pass", label: "Pass" },
    { v: "fail", label: "Fail" },
    { v: "skip", label: "Skip" },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {opts.map((o) => (
        <label
          key={o.v}
          className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold ${
            value === o.v
              ? o.v === "pass"
                ? "border-success bg-success-bg text-success"
                : o.v === "fail"
                  ? "border-danger bg-danger-bg text-danger"
                  : "border-warning bg-warning-bg text-warning"
              : "border-grid bg-surface text-muted hover:bg-surface-2"
          }`}
        >
          <input
            type="radio"
            className="sr-only"
            name={name}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function StepRow({
  step,
  result,
  note,
  onResult,
  onNote,
}: {
  step: TestStep;
  result: StepResult;
  note: string;
  onResult: (v: StepResult) => void;
  onNote: (n: string) => void;
}) {
  return (
    <li className="rounded-lg border border-grid bg-surface px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">
            {step.id}
          </div>
          <p className="mt-0.5 text-sm">{step.label}</p>
          {step.href && (
            <Link
              href={step.href}
              className="mt-1 inline-block text-xs font-semibold text-accent-dk no-underline hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open {step.href} ↗
            </Link>
          )}
        </div>
        <ResultRadios
          name={`step-${step.id}`}
          value={result}
          onChange={onResult}
        />
      </div>
      {(result === "fail" || result === "skip" || note) && (
        <input
          type="text"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Note (required for Fail / helpful for Skip)"
          className="mt-2 w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
        />
      )}
    </li>
  );
}

export function OwnerTestNotes() {
  const [state, setState] = useState<TestNotesState>(emptyTestNotesState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadState());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const allStepIds = useMemo(() => {
    const ids = TEST_PREFLIGHT.map((s) => s.id);
    for (const sec of TEST_SECTIONS) {
      for (const s of sec.steps) ids.push(s.id);
    }
    return ids;
  }, []);

  const progress = useMemo(() => {
    const done = allStepIds.filter((id) => {
      const r = state.steps[id]?.result;
      return r === "pass" || r === "fail" || r === "skip";
    }).length;
    return { done, total: allStepIds.length };
  }, [allStepIds, state.steps]);

  function setStep(id: string, patch: Partial<{ result: StepResult; note: string }>) {
    setState((prev) => {
      const cur = prev.steps[id] ?? { result: "" as StepResult, note: "" };
      return {
        ...prev,
        steps: { ...prev.steps, [id]: { ...cur, ...patch } },
      };
    });
  }

  function reset() {
    if (!confirm("Clear all checkboxes and notes on this device?")) return;
    setState(emptyTestNotesState());
    localStorage.removeItem(STORAGE_KEY);
  }

  function stepOf(id: string) {
    return state.steps[id] ?? { result: "" as StepResult, note: "" };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Owner walkthrough
        </p>
        <h1 className="text-2xl font-bold">{TEST_NOTES_META.title}</h1>
        <p className="mt-1 text-sm text-muted">{TEST_NOTES_META.purpose}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li>
            <span className="font-semibold">App:</span>{" "}
            {TEST_NOTES_META.appUrl}
          </li>
          <li>
            <span className="font-semibold">Login:</span>{" "}
            {TEST_NOTES_META.loginHint}
          </li>
          <li>
            <span className="font-semibold">Data:</span>{" "}
            {TEST_NOTES_META.dataNote}
          </li>
          <li>
            <span className="font-semibold">Source:</span>{" "}
            {TEST_NOTES_META.sourceDoc}
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            Progress: {progress.done} / {progress.total}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-grid px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
          >
            Reset on this device
          </button>
          <p className="text-xs text-muted">
            Answers stay in your browser (localStorage) — not saved to the
            server.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Before you start</h2>
        <ul className="space-y-2">
          {TEST_PREFLIGHT.map((step) => {
            const s = stepOf(step.id);
            return (
              <StepRow
                key={step.id}
                step={step}
                result={s.result}
                note={s.note}
                onResult={(v) => setStep(step.id, { result: v })}
                onNote={(n) => setStep(step.id, { note: n })}
              />
            );
          })}
        </ul>
      </section>

      {TEST_SECTIONS.map((sec) => (
        <section key={sec.id} className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">
              {sec.title}
              {sec.minutes ? (
                <span className="ml-2 text-sm font-normal text-muted">
                  {sec.minutes}
                </span>
              ) : null}
            </h2>
            {sec.intro && (
              <p className="mt-1 text-sm text-muted">{sec.intro}</p>
            )}
          </div>
          <ul className="space-y-2">
            {sec.steps.map((step) => {
              const s = stepOf(step.id);
              return (
                <StepRow
                  key={step.id}
                  step={step}
                  result={s.result}
                  note={s.note}
                  onResult={(v) => setStep(step.id, { result: v })}
                  onNote={(n) => setStep(step.id, { note: n })}
                />
              );
            })}
          </ul>
          {sec.overallPrompt && (
            <label className="block text-sm">
              <span className="font-semibold">{sec.overallPrompt}</span>
              <input
                type="text"
                value={state.sectionNotes[sec.id] ?? ""}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    sectionNotes: {
                      ...prev.sectionNotes,
                      [sec.id]: e.target.value,
                    },
                  }))
                }
                placeholder="Approved / notes / rework…"
                className="mt-1 w-full rounded-lg border border-grid bg-surface px-3 py-2"
              />
            </label>
          )}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          7. Explicitly out of scope (not bugs)
        </h2>
        <ul className="divide-y divide-grid rounded-lg border border-grid bg-surface">
          {OUT_OF_SCOPE.map((row) => (
            <li
              key={row.item}
              className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span>{row.item}</span>
              <span className="text-muted">{row.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-lg border border-grid bg-surface p-4">
        <h2 className="text-lg font-bold">Your verdict</h2>
        <p className="text-xs text-muted">
          Copy this into OWNER_PROJECT_AUDIT or email Brett / return a
          screenshot.
        </p>
        <label className="block text-sm">
          <span className="font-semibold">Date</span>
          <input
            type="text"
            value={state.verdict.date}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, date: e.target.value },
              }))
            }
            placeholder="MM/DD/YYYY"
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">
            Overall direction (phases 0–10 as demoed)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["approved", "Approved"],
                ["approved_notes", "Approved with notes"],
                ["pause", "Pause / rework"],
              ] as const
            ).map(([v, label]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  state.verdict.overall === v
                    ? "border-accent-dk bg-accent-lt text-accent-dk"
                    : "border-grid hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="overall"
                  checked={state.verdict.overall === v}
                  onChange={() =>
                    setState((prev) => ({
                      ...prev,
                      verdict: { ...prev.verdict, overall: v },
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-semibold">Biggest gap for daily firm use</span>
          <textarea
            value={state.verdict.biggestGap}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, biggestGap: e.target.value },
              }))
            }
            rows={2}
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Next priority</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["deepen", "Deepen CM / Lit"],
                ["phase7", "Phase 7 after screen sign-off"],
                ["casepeer", "CasePeer rehearsal (after BAA)"],
                ["other", "Other"],
              ] as const
            ).map(([v, label]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  state.verdict.nextPriority === v
                    ? "border-accent-dk bg-accent-lt text-accent-dk"
                    : "border-grid hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="next"
                  checked={state.verdict.nextPriority === v}
                  onChange={() =>
                    setState((prev) => ({
                      ...prev,
                      verdict: { ...prev.verdict, nextPriority: v },
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {state.verdict.nextPriority === "other" && (
            <input
              type="text"
              value={state.verdict.nextOther}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  verdict: { ...prev.verdict, nextOther: e.target.value },
                }))
              }
              placeholder="Describe other priority"
              className="mt-2 w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
            />
          )}
        </fieldset>
        <label className="block text-sm">
          <span className="font-semibold">Bugs / UX notes</span>
          <textarea
            value={state.verdict.bugs}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, bugs: e.target.value },
              }))
            }
            rows={4}
            placeholder={"URL + what you clicked + what you saw\n- …"}
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <p className="text-xs text-muted">
          Tester: Michael Tuttle · Signed verbally / email is fine.
        </p>
      </section>
    </div>
  );
}
