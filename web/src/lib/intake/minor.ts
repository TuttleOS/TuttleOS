import { parseDateValue, todayIsoLocal } from "@/lib/dates";

/** Age in whole years as of today (local calendar). */
export function ageYearsAsOfToday(
  dob: string | Date | null | undefined,
  now = new Date(),
): number | null {
  const d = parseDateValue(dob);
  if (!d) return null;
  const today = parseDateValue(todayIsoLocal(now));
  if (!today) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

/** Under 18 as of today from DOB. */
export function isUnder18FromDob(
  dob: string | Date | null | undefined,
  now = new Date(),
): boolean {
  const age = ageYearsAsOfToday(dob, now);
  return age != null && age < 18;
}

/**
 * Minor for intake prompts.
 * DOB wins when present (under 18 as of today). Toggle only applies if DOB is unknown.
 */
export function isMinorClient(input: {
  date_of_birth?: string | null;
  is_minor_toggle?: boolean | null;
}): boolean {
  if (input.date_of_birth) {
    return isUnder18FromDob(input.date_of_birth);
  }
  return !!input.is_minor_toggle;
}
