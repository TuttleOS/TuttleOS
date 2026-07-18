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
    { v: "pass", label: "Looks good" },
    { v: "fail", label: "Problem" },
    { v: "skip", label: "Skip for now" },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {opts.map((o) => (
        <label
          key={o.v}
          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
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
    <li className="rounded-lg border border-grid bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Step {step.id}
            </div>
            <h3 className="mt-0.5 text-base font-bold">{step.label}</h3>
          </div>
          {step.how && (
            <p className="text-sm">
              <span className="font-semibold text-accent-dk">What to do: </span>
              {step.how}
            </p>
          )}
          {step.expect && (
            <p className="text-sm text-muted">
              <span className="font-semibold">What you should see: </span>
              {step.expect}
            </p>
          )}
          {step.href && (
            <Link
              href={step.href}
              className="mt-1 inline-flex rounded-lg border border-accent-dk/30 bg-accent-lt px-3 py-1.5 text-xs font-bold text-accent-dk no-underline hover:bg-accent-lt/80"
              target="_blank"
              rel="noreferrer"
            >
              {step.linkLabel ?? "Open this screen"} ↗
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
          placeholder={
            result === "fail"
              ? "What went wrong? (page name + what you clicked)"
              : "Optional note"
          }
          className="mt-3 w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
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

  function setStep(
    id: string,
    patch: Partial<{ result: StepResult; note: string }>,
  ) {
    setState((prev) => {
      const cur = prev.steps[id] ?? { result: "" as StepResult, note: "" };
      return {
        ...prev,
        steps: { ...prev.steps, [id]: { ...cur, ...patch } },
      };
    });
  }

  function reset() {
    if (
      !confirm(
        "Clear all your answers and notes on this computer? This cannot be undone.",
      )
    )
      return;
    setState(emptyTestNotesState());
    localStorage.removeItem(STORAGE_KEY);
  }

  function stepOf(id: string) {
    return state.steps[id] ?? { result: "" as StepResult, note: "" };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          For Michael · guided tour
        </p>
        <h1 className="text-2xl font-bold">{TEST_NOTES_META.title}</h1>
        <p className="text-sm leading-relaxed">{TEST_NOTES_META.purpose}</p>
        <div className="rounded-lg border border-grid bg-surface-2 px-4 py-3 text-sm leading-relaxed space-y-2">
          <p>
            <span className="font-semibold">How long:</span>{" "}
            {TEST_NOTES_META.howLong}
          </p>
          <p>
            <span className="font-semibold">Sign in as:</span>{" "}
            {TEST_NOTES_META.loginHint}
          </p>
          <p>
            <span className="font-semibold">Practice data only:</span>{" "}
            {TEST_NOTES_META.dataNote}
          </p>
          <p>
            <span className="font-semibold">Tip:</span> {TEST_NOTES_META.tip}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            Progress: {progress.done} of {progress.total} steps answered
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-grid px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
          >
            Start over
          </button>
          <p className="text-xs text-muted">
            Your answers stay on this computer only. They are not emailed
            automatically — when finished, tell Brett or send a screenshot of
            Your verdict below.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Before you start</h2>
        <ul className="space-y-3">
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
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {sec.intro}
              </p>
            )}
          </div>
          <ul className="space-y-3">
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
                placeholder="A sentence or two is enough"
                className="mt-1 w-full rounded-lg border border-grid bg-surface px-3 py-2"
              />
            </label>
          )}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          7. Things that are NOT bugs (on purpose)
        </h2>
        <p className="text-sm text-muted">
          If something below is missing, that is expected for this review —
          please do not mark it as broken.
        </p>
        <ul className="divide-y divide-grid rounded-lg border border-grid bg-surface">
          {OUT_OF_SCOPE.map((row) => (
            <li
              key={row.item}
              className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:justify-between sm:gap-4"
            >
              <span className="font-medium">{row.item}</span>
              <span className="text-muted sm:text-right">{row.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-lg border border-grid bg-surface p-4">
        <h2 className="text-lg font-bold">Your overall verdict</h2>
        <p className="text-sm text-muted">
          When you finish, email Brett or send a screenshot of this section.
          Verbal feedback is fine too.
        </p>
        <label className="block text-sm">
          <span className="font-semibold">Today&apos;s date</span>
          <input
            type="text"
            value={state.verdict.date}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, date: e.target.value },
              }))
            }
            placeholder="Example: 07/18/2026"
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">
            Overall — keep building in this direction?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["approved", "Yes — looks good"],
                ["approved_notes", "Yes — with notes below"],
                ["pause", "Pause / needs rework first"],
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
          <span className="font-semibold">
            Biggest gap for daily firm use right now
          </span>
          <textarea
            value={state.verdict.biggestGap}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, biggestGap: e.target.value },
              }))
            }
            rows={2}
            placeholder="What is missing that would block real use?"
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">
            What should Brett work on next?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["deepen", "More Case Manager / Litigation detail"],
                ["phase7", "Demand / Liens / Review after I approve screens"],
                ["casepeer", "Practice load from CasePeer (after privacy paperwork)"],
                ["other", "Something else"],
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
              placeholder="What should come next?"
              className="mt-2 w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
            />
          )}
        </fieldset>
        <label className="block text-sm">
          <span className="font-semibold">Problems or confusing spots</span>
          <textarea
            value={state.verdict.bugs}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                verdict: { ...prev.verdict, bugs: e.target.value },
              }))
            }
            rows={4}
            placeholder={
              "Write freely. Helpful format:\n- Which screen\n- What you clicked\n- What happened (or what you expected)"
            }
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
          />
        </label>
        <p className="text-xs text-muted">
          Tester: Michael Tuttle — no formal signature needed; email or a call
          is enough.
        </p>
      </section>
    </div>
  );
}
