import { addYears, differenceInCalendarDays } from "date-fns";
import { formatDate, parseDateValue } from "@/lib/dates";

/**
 * Intake est. SOL preview — DOI + 2 years (matches mockup).
 * Always shown with ATTORNEY-VERIFY; DB compute_pi_sol refines after sign-up.
 */
export function estimateSolPreview(incidentDate: string | Date | null | undefined): {
  solDate: Date;
  label: string;
  days: number;
  urgency: "far" | "near" | "crit";
} | null {
  if (!incidentDate) return null;
  const base = parseDateValue(incidentDate);
  if (!base) return null;
  const solDate = addYears(base, 2);
  const days = differenceInCalendarDays(solDate, new Date());
  const urgency = days < 120 ? "crit" : days < 365 ? "near" : "far";
  return {
    solDate,
    days,
    urgency,
    label: `${formatDate(solDate)} (${days}d) · ATTORNEY-VERIFY`,
  };
}

export function estimateSolIso(incidentDate: string | null | undefined): string | null {
  const p = estimateSolPreview(incidentDate);
  if (!p) return null;
  const y = p.solDate.getFullYear();
  const m = String(p.solDate.getMonth() + 1).padStart(2, "0");
  const d = String(p.solDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
