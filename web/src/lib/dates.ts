import { format, isValid } from "date-fns";

/**
 * Firm date display: MM/DD/YYYY (always includes year — owner rule #16).
 * Storage / APIs stay ISO `yyyy-MM-dd`.
 */

/** Parse a calendar date without timezone shift (ISO or MM/DD/YYYY). */
export function parseDateValue(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const s = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      12,
      0,
      0,
    );
    return isValid(d) ? d : null;
  }

  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mdy) {
    const d = new Date(
      Number(mdy[3]),
      Number(mdy[1]) - 1,
      Number(mdy[2]),
      12,
      0,
      0,
    );
    return isValid(d) ? d : null;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display format everywhere: MM/DD/YYYY */
export function formatDate(value: Date | string | null | undefined): string {
  const d = parseDateValue(value);
  if (!d) return "—";
  return format(d, "MM/dd/yyyy");
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const d = parseDateValue(value);
  if (!d) return "—";
  return format(d, "MM/dd/yyyy, h:mm a");
}

/** Convert user/ISO input → `yyyy-MM-dd` for DB, or "" if empty/invalid. */
export function toIsoDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const d = parseDateValue(value);
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

/** ISO → MM/DD/YYYY for controlled inputs (empty stays empty). */
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseDateValue(iso);
  if (!d) return "";
  return format(d, "MM/dd/yyyy");
}
