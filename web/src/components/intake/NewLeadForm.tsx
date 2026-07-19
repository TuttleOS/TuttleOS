"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeadAction } from "@/lib/intake/actions";
import { CASE_TYPE_OPTIONS } from "@/lib/intake/case-types";
import { formToGate } from "@/lib/intake/gate";
import {
  formatPhoneDisplay,
  phoneHint,
  type PhoneCountry,
} from "@/lib/intake/phone";
import { estimateSolPreview } from "@/lib/intake/sol";
import { DateField } from "@/components/ui/DateField";

type CompanionRow = {
  key: string;
  full_name: string;
  email: string;
  date_of_birth: string;
};

export function NewLeadForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [suffix, setSuffix] = useState("");
  const [goesBy, setGoesBy] = useState("");
  const [dob, setDob] = useState("");
  const [type, setType] = useState("");
  const [doi, setDoi] = useState("");
  const [loc, setLoc] = useState("");
  const [country, setCountry] = useState<PhoneCountry>("US");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [inPerson, setInPerson] = useState(false);
  const [lang, setLang] = useState<"en" | "es" | "other">("en");
  const [source, setSource] = useState("");
  const [companions, setCompanions] = useState<CompanionRow[]>([]);

  const digits = phone.replace(/\D/g, "").slice(0, 10);
  const hint = phoneHint(country, digits);
  const gate = useMemo(
    () =>
      formToGate({
        first_name: first,
        last_name: last,
        case_type_code: type,
        incident_date: doi,
        location: loc,
        phone_country: country,
        phone_digits: digits,
        email,
        in_person_signing: inPerson,
        preferred_language: lang,
      }),
    [first, last, type, doi, loc, country, digits, email, inPerson, lang],
  );
  const sol = estimateSolPreview(doi || null);

  function onPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    setPhone(formatPhoneDisplay(country, d));
  }

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement).focus?.();
    el.classList.add("ring-2", "ring-accent");
    setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1600);
  }

  function addCompanion() {
    setCompanions((prev) => [
      ...prev,
      {
        key: `c-${Date.now()}-${prev.length}`,
        full_name: "",
        email: "",
        date_of_birth: "",
      },
    ]);
  }

  function updateCompanion(
    key: string,
    patch: Partial<Omit<CompanionRow, "key">>,
  ) {
    setCompanions((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  }

  function removeCompanion(key: string) {
    setCompanions((prev) => prev.filter((c) => c.key !== key));
  }

  function save(partial: boolean) {
    setError(null);
    start(async () => {
      const res = await createLeadAction({
        first_name: first,
        middle_name: middle,
        last_name: last,
        suffix,
        goes_by: goesBy,
        date_of_birth: dob || undefined,
        case_type_code: type,
        incident_date: doi,
        location: loc,
        phone_country: country,
        phone_digits: digits,
        email,
        in_person_signing: inPerson,
        preferred_language: lang,
        marketing_source: source,
        companions: companions
          .filter((c) => c.full_name.trim())
          .map((c) => ({
            full_name: c.full_name,
            email: c.email,
            date_of_birth: c.date_of_birth || undefined,
          })),
        partial,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.id ? `/intake/leads/${res.id}` : "/intake");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-panel border border-grid bg-surface p-6 shadow-soft">
        <h1 className="text-xl font-bold">New Lead — the six minimums</h1>
        <p className="mt-1 text-sm text-muted">
          Primary person below. Add others on the same crash with name, email,
          and optional DOB — each becomes their own linked lead.
        </p>

        <div className="mt-4 grid gap-x-3 sm:grid-cols-2">
          <Field label="First name" required>
            <input
              id="f-first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Rosa"
            />
          </Field>
          <Field label="Middle name">
            <input
              id="f-middle"
              value={middle}
              onChange={(e) => setMiddle(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </Field>
          <Field label="Last name" required>
            <input
              id="f-last"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Delgado"
            />
          </Field>
          <Field label="Suffix">
            <select
              id="f-suffix"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3 text-sm outline-none focus:border-accent"
            >
              <option value="">—</option>
              <option>Jr.</option>
              <option>Sr.</option>
              <option>II</option>
              <option>III</option>
              <option>IV</option>
            </select>
          </Field>
        </div>

        <Field label="Goes by">
          <input
            id="f-goesby"
            value={goesBy}
            onChange={(e) => setGoesBy(e.target.value)}
            className={INPUT}
            placeholder="Nickname"
          />
        </Field>

        <Field label="Date of birth" hint="optional · MM/DD/YYYY">
          <DateField
            id="f-dob"
            value={dob}
            onChange={setDob}
            className={INPUT}
          />
        </Field>

        <Field label="Incident type" required>
          <select
            id="f-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={INPUT}
          >
            <option value="">— choose —</option>
            {CASE_TYPE_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Incident date" required hint="MM/DD/YYYY">
          <DateField
            id="f-doi"
            value={doi}
            onChange={setDoi}
            className={INPUT}
            required
          />
        </Field>

        <Field label="Injury location" required hint="city → county → description">
          <input
            id="f-loc"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            className={INPUT}
            placeholder="San Antonio — or HEB parking lot off I-35 near Schertz"
          />
        </Field>

        <Field label="Client phone" required>
          <div className="flex w-full min-w-0 items-center gap-2">
            <select
              id="f-country"
              value={country}
              onChange={(e) => {
                const c = e.target.value as PhoneCountry;
                setCountry(c);
                setPhone(formatPhoneDisplay(c, digits));
              }}
              className={`${INPUT_BASE} w-[7.5rem] shrink-0`}
            >
              <option value="US">🇺🇸 +1</option>
              <option value="MX">🇲🇽 +52</option>
            </select>
            <input
              id="f-phone"
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              className={`${INPUT_BASE} min-w-0 flex-1`}
              placeholder={country === "US" ? "(210) 555-0000" : "55 1234 5678"}
            />
          </div>
          <p
            className={`mt-1 text-xs ${
              hint.ok === true
                ? "text-success"
                : hint.ok === false
                  ? "text-danger"
                  : "text-muted"
            }`}
          >
            {hint.text}
          </p>
        </Field>

        <Field label="Client email" required>
          <input
            id="f-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            disabled={inPerson}
            placeholder="client@email.com"
          />
        </Field>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            id="f-inperson"
            type="checkbox"
            checked={inPerson}
            onChange={(e) => setInPerson(e.target.checked)}
          />
          In-person signing (waives email only — audit-logged)
        </label>

        <Field label="Primary language">
          <select
            id="f-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "es" | "other")}
            className={INPUT}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Marketing / source">
          <input
            id="f-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={INPUT}
            placeholder="Google Ads, referral, walk-in…"
          />
        </Field>

        <div className="mt-6 border-t border-grid pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
                Others on this crash
              </h2>
              <p className="mt-1 text-xs text-muted">
                Name + email (+ optional DOB). Each person gets their own lead,
                linked to the same crash.
              </p>
            </div>
            <button
              type="button"
              onClick={addCompanion}
              className="rounded-lg border border-grid bg-page px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
            >
              + Add person
            </button>
          </div>

          {companions.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              No companions yet — click Add person for passengers / family on
              this wreck.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {companions.map((c, idx) => (
                <li
                  key={c.key}
                  className="rounded-lg border border-grid bg-page p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      Person {idx + 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCompanion(c.key)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <Field label="Full name" required>
                    <input
                      value={c.full_name}
                      onChange={(e) =>
                        updateCompanion(c.key, { full_name: e.target.value })
                      }
                      className={INPUT}
                      placeholder="Jordan Reyes"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={c.email}
                      onChange={(e) =>
                        updateCompanion(c.key, { email: e.target.value })
                      }
                      className={INPUT}
                      placeholder="jordan@example.com"
                    />
                  </Field>
                  <Field label="Date of birth" hint="optional">
                    <DateField
                      value={c.date_of_birth}
                      onChange={(iso) =>
                        updateCompanion(c.key, { date_of_birth: iso })
                      }
                      className={INPUT}
                    />
                  </Field>
                </li>
              ))}
            </ul>
          )}
        </div>

        {sol && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm text-warning">
            Est. SOL: <strong>{sol.label}</strong> — auto-computed as DOI + 2
            years; limitations analysis refines after sign-up.
          </div>
        )}

        <div
          className={`mt-4 rounded-lg px-3 py-2.5 text-sm font-semibold ${
            gate.ready
              ? "bg-success-bg text-success"
              : "bg-danger-bg text-danger"
          }`}
        >
          {gate.ready ? (
            "✔ Gate satisfied — matter can open at signature"
          ) : (
            <>
              ✕ {gate.missing.length} of 6 minimums outstanding — click to fix:{" "}
              {gate.missing.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="ml-2 underline"
                  onClick={() => jump(m.fieldId)}
                >
                  {m.label}
                </button>
              ))}
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !gate.ready}
            onClick={() => save(false)}
            className="rounded-lg bg-accent-dk px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : companions.some((c) => c.full_name.trim())
                ? "Save lead + companions"
                : "Save lead"}
          </button>
          <button
            type="button"
            disabled={pending || (!first.trim() && !last.trim())}
            onClick={() => save(true)}
            className="rounded-lg border border-grid bg-surface px-4 py-2.5 text-sm text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Save partial (lead only)
          </button>
        </div>
      </section>

      <aside className="rounded-panel border border-grid bg-surface p-6 shadow-soft">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
          What happens next
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted">
          <li>Primary lead saved → appears in the queue.</li>
          <li>
            <strong>Add person</strong> creates extra leads on the same crash
            (each keeps their own file; companions show under Same crash).
          </li>
          <li>Estimated SOL is computed immediately — even for rejects.</li>
          <li>Gate satisfied → mark contract sent when ready.</li>
          <li>
            Signature → open the matter; companions convert onto the shared
            crash. Intake&apos;s job is done.
          </li>
        </ol>
      </aside>
    </div>
  );
}

const INPUT_BASE =
  "h-10 rounded-lg border border-grid bg-page px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";
const INPUT = `${INPUT_BASE} w-full`;

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      {required && <span className="text-danger"> *</span>}
      {hint && <span className="ml-1 font-normal">({hint})</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
