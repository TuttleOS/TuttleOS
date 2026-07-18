/** US / MX phone formatting for Intake (10-digit gate; E.164 via DB trigger). */

export type PhoneCountry = "US" | "MX";

export function digitsOnly(value: string, max = 10): string {
  return value.replace(/\D/g, "").slice(0, max);
}

export function formatPhoneDisplay(country: PhoneCountry, digits: string): string {
  const d = digitsOnly(digits);
  if (country === "US") {
    if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return d;
  }
  // MX
  if (d.length > 6) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.length > 2) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return d;
}

export function isPhoneComplete(digits: string): boolean {
  return digitsOnly(digits).length === 10;
}

/** Value stored on contact_point.phone — trigger normalizes to phone_e164. */
export function phoneForStorage(country: PhoneCountry, digits: string): string {
  const d = digitsOnly(digits);
  if (d.length !== 10) return d;
  return country === "US" ? `+1${d}` : `+52${d}`;
}

export function phoneHint(
  country: PhoneCountry,
  digits: string,
): { text: string; ok: boolean | null } {
  const d = digitsOnly(digits);
  if (!d.length) {
    return {
      text: "Digits only. US is default; switch to MX for Mexican numbers.",
      ok: null,
    };
  }
  if (isPhoneComplete(d)) {
    return {
      text: `Valid — stored as ${country === "US" ? "+1" : "+52"}${d}`,
      ok: true,
    };
  }
  return {
    text: `${d.length} of 10 digits — a complete ${country === "US" ? "US" : "Mexican"} number is required for the gate`,
    ok: false,
  };
}
