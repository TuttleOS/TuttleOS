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

export function NewLeadForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [suffix, setSuffix] = useState("");
  const [goesBy, setGoesBy] = useState("");
  const [type, setType] = useState("");
  const [doi, setDoi] = useState("");
  const [loc, setLoc] = useState("");
  const [country, setCountry] = useState<PhoneCountry>("US");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [inPerson, setInPerson] = useState(false);
  const [lang, setLang] = useState<"en" | "es" | "other">("en");
  const [source, setSource] = useState("");

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

  function save(partial: boolean) {
    setError(null);
    start(async () => {
      const res = await createLeadAction({
        first_name: first,
        middle_name: middle,
        last_name: last,
        suffix,
        goes_by: goesBy,
        case_type_code: type,
        incident_date: doi,
        location: loc,
        phone_country: country,
        phone_digits: digits,
        email,
        in_person_signing: inPerson,
        preferred_language: lang,
        marketing_source: source,
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
          Only these six facts are required to sign someone up. Everything else
          can wait. Partial save is always allowed for a lead — the gate only
          blocks opening a matter.
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
            {pending ? "Saving…" : "Save lead"}
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
          <li>Lead saved → appears in the queue.</li>
          <li>Estimated SOL is computed immediately — even for rejects.</li>
          <li>Gate satisfied → mark contract sent when ready.</li>
          <li>
            Signature → open the matter; DB stamps dates and CM checklist path.
            Intake&apos;s job is done.
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
