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
}: {
  id?: string;
  /** ISO yyyy-MM-dd or empty */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setText("");
      return;
    }
    const iso = toIsoDate(trimmed);
    if (iso) {
      onChange(iso);
      setText(isoToDisplay(iso));
    }
  }

  return (
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
      onChange={(e) => setText(e.target.value)}
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
    />
  );
}
