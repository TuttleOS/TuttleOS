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
