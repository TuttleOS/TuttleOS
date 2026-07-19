"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadTemperatureAction } from "@/lib/intake/actions";
import {
  LEAD_TEMPERATURE_META,
  type LeadTemperature,
} from "@/lib/intake/types";

const OPTIONS: { value: "" | LeadTemperature; label: string }[] = [
  { value: "", label: "—" },
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

export function LeadTemperatureSelect({
  leadId,
  value,
}: {
  leadId: string;
  value: LeadTemperature | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<LeadTemperature | null>(value);
  const [error, setError] = useState<string | null>(null);

  function onChange(next: string) {
    const temp = (next || null) as LeadTemperature | null;
    setError(null);
    setCurrent(temp);
    startTransition(async () => {
      const res = await updateLeadTemperatureAction(leadId, temp);
      if (!res.ok) {
        setError(res.error);
        setCurrent(value);
        return;
      }
      router.refresh();
    });
  }

  const chip =
    current && LEAD_TEMPERATURE_META[current]
      ? LEAD_TEMPERATURE_META[current].chip
      : "bg-surface-2 text-ink border-grid";

  return (
    <label className="inline-flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Temperature
      </span>
      <select
        className={`rounded border px-2 py-1 text-xs font-semibold ${chip} disabled:opacity-60`}
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Lead temperature"
      >
        {OPTIONS.map((o) => (
          <option key={o.label} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : null}
    </label>
  );
}
