/** Contingent fee tiers for the firm contingent-fee contract (C2). */

export const FEE_PRE_SUIT_MIN = 33.333;
export const FEE_PRE_SUIT_MAX = 40;
export const FEE_FILED_MIN = 40;
export const FEE_FILED_MAX = 45;
export const FEE_APPEAL_FIXED = 50;

export const FEE_PRE_SUIT_DEFAULT = 40;
export const FEE_FILED_DEFAULT = 45;

const EPS = 0.0005;

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n + EPS >= min && n - EPS <= max;
}

export function clampFeePreSuit(n: number): number {
  if (!Number.isFinite(n)) return FEE_PRE_SUIT_DEFAULT;
  return Math.min(FEE_PRE_SUIT_MAX, Math.max(FEE_PRE_SUIT_MIN, n));
}

export function clampFeeFiled(n: number): number {
  if (!Number.isFinite(n)) return FEE_FILED_DEFAULT;
  return Math.min(FEE_FILED_MAX, Math.max(FEE_FILED_MIN, n));
}

/** Display number in contract / inputs (keep one-third precision). */
export function formatFeePercent(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n - FEE_PRE_SUIT_MIN) < EPS) return "33.333";
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function validateContractFees(input: {
  feePreSuit: number;
  feePostFiling: number;
  feeAppeal: number;
}): { ok: true } | { ok: false; error: string } {
  if (!inRange(input.feePreSuit, FEE_PRE_SUIT_MIN, FEE_PRE_SUIT_MAX)) {
    return {
      ok: false,
      error: `Pre-suit fee must be between ${FEE_PRE_SUIT_MIN}% and ${FEE_PRE_SUIT_MAX}%`,
    };
  }
  if (!inRange(input.feePostFiling, FEE_FILED_MIN, FEE_FILED_MAX)) {
    return {
      ok: false,
      error: `Filed fee must be between ${FEE_FILED_MIN}% and ${FEE_FILED_MAX}%`,
    };
  }
  if (Math.abs(input.feeAppeal - FEE_APPEAL_FIXED) > EPS) {
    return {
      ok: false,
      error: `Appeal fee is fixed at ${FEE_APPEAL_FIXED}%`,
    };
  }
  return { ok: true };
}
