"use client";

import { useEffect, useState } from "react";
import { isoToDisplay, toIsoDate } from "@/lib/dates";

/**
 * Date entry as MM/DD/YYYY (avoids browser-locale native date inputs).
 * `value` / `onChange` use ISO `yyyy-MM-dd` for storage.
 */
export function DateField({
  id,
  value,
  onChange,
  className,
  required,
  disabled,
  name,
  max,
  min,
}: {
  id?: string;
  /** ISO yyyy-MM-dd or empty */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  /** ISO yyyy-MM-dd — reject later dates on commit */
  max?: string;
  /** ISO yyyy-MM-dd — reject earlier dates on commit */
  min?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [rangeErr, setRangeErr] = useState<string | null>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setText("");
      setRangeErr(null);
      return;
    }
    const iso = toIsoDate(trimmed);
    if (!iso) {
      setText(isoToDisplay(value));
      setRangeErr(null);
      return;
    }
    if (max && iso > max) {
      setText(isoToDisplay(value));
      setRangeErr("Date cannot be in the future");
      return;
    }
    if (min && iso < min) {
      setText(isoToDisplay(value));
      setRangeErr("Date is before the allowed range");
      return;
    }
    setRangeErr(null);
    onChange(iso);
    setText(isoToDisplay(iso));
  }

  return (
    <div className="min-w-0">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        autoComplete="off"
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (rangeErr) setRangeErr(null);
        }}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={className}
        aria-label={name ?? id ?? "Date MM/DD/YYYY"}
        aria-invalid={rangeErr ? true : undefined}
      />
      {rangeErr ? (
        <p className="mt-1 text-xs text-danger">{rangeErr}</p>
      ) : null}
    </div>
  );
}
