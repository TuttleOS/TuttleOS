/** Machine tag in workflow.document.notes — no schema migration required. */
const PD_VEHICLE_TAG =
  /^\[pd_vehicle:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\s*/i;

export function encodePdVehicleNote(
  vehicleId: string | null | undefined,
  notes: string | null | undefined,
): string | null {
  const body = (notes ?? "").replace(PD_VEHICLE_TAG, "").trim();
  if (!vehicleId) return body || null;
  return body ? `[pd_vehicle:${vehicleId}] ${body}` : `[pd_vehicle:${vehicleId}]`;
}

export function parsePdVehicleId(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(PD_VEHICLE_TAG);
  return m?.[1] ?? null;
}

export function stripPdVehicleTag(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const stripped = notes.replace(PD_VEHICLE_TAG, "").trim();
  return stripped || null;
}

export function normalizeVehicleKey(
  year: number | null | undefined,
  make: string,
  model: string,
): string {
  const y = year == null || Number.isNaN(year) ? "" : String(year);
  return `${y}|${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
}

export function formatVehicleLabel(
  year: number | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  return [year, make, model].filter(Boolean).join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

type VehicleName = {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
};

function asYear(y: number | string | null | undefined): number | null {
  if (y == null || y === "") return null;
  const n = typeof y === "number" ? y : Number(String(y).trim());
  return Number.isFinite(n) ? n : null;
}

/** Same year + make, and model is exact or a close typo (Civic / Civik, Camry / Camery). */
export function vehiclesLookLikeSame(a: VehicleName, b: VehicleName): boolean {
  const makeA = (a.make ?? "").trim().toLowerCase();
  const makeB = (b.make ?? "").trim().toLowerCase();
  const modelA = (a.model ?? "").trim().toLowerCase();
  const modelB = (b.model ?? "").trim().toLowerCase();
  const yearA = asYear(a.year);
  const yearB = asYear(b.year);
  if (
    normalizeVehicleKey(yearA, makeA, modelA) ===
    normalizeVehicleKey(yearB, makeB, modelB)
  ) {
    return true;
  }
  if (yearA !== yearB || !modelA || !modelB) return false;
  const makeDist = levenshtein(makeA, makeB);
  if (makeDist > 1) return false;
  const dist = levenshtein(modelA, modelB);
  if (dist <= 1) return true;
  return Math.max(modelA.length, modelB.length) >= 6 && dist <= 2;
}
