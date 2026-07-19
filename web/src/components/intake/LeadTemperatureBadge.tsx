import {
  LEAD_TEMPERATURE_META,
  type LeadTemperature,
} from "@/lib/intake/types";

export function LeadTemperatureBadge({
  value,
}: {
  value: LeadTemperature | null | undefined;
}) {
  if (!value) return null;
  const meta = LEAD_TEMPERATURE_META[value];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
    >
      {meta.label}
    </span>
  );
}
