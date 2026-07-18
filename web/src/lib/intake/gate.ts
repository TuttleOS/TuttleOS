import type { GateItem, LeadFormInput, LeadRow } from "./types";
import { isPhoneComplete } from "./phone";
import { caseTypeLabel } from "./case-types";

export function evaluateGate(input: {
  first_name?: string | null;
  last_name?: string | null;
  case_type_code?: string | null;
  incident_date?: string | null;
  location?: string | null;
  phone_digits?: string | null;
  email?: string | null;
  in_person_signing?: boolean;
}): { items: GateItem[]; ready: boolean; missing: GateItem[] } {
  const nameOk = !!(input.first_name?.trim() && input.last_name?.trim());
  const typeOk = !!input.case_type_code;
  const doiOk = !!input.incident_date;
  const locOk = !!input.location?.trim();
  const phoneOk = isPhoneComplete(input.phone_digits ?? "");
  const emailOk = !!input.email?.trim() || !!input.in_person_signing;

  const items: GateItem[] = [
    {
      key: "name",
      label: "Client name",
      ok: nameOk,
      fieldId: "f-first",
      value: nameOk
        ? `${input.first_name} ${input.last_name}`.trim()
        : "— First and Last required",
    },
    {
      key: "type",
      label: "Incident type",
      ok: typeOk,
      fieldId: "f-type",
      value: typeOk ? caseTypeLabel(input.case_type_code) : "— required",
    },
    {
      key: "doi",
      label: "Incident date",
      ok: doiOk,
      fieldId: "f-doi",
      value: doiOk ? String(input.incident_date) : "— required",
    },
    {
      key: "location",
      label: "Injury location",
      ok: locOk,
      fieldId: "f-loc",
      value: locOk ? String(input.location) : "— city, county, or description required",
    },
    {
      key: "phone",
      label: "Phone",
      ok: phoneOk,
      fieldId: "f-phone",
      value: phoneOk ? String(input.phone_digits) : "— required",
    },
    {
      key: "email",
      label: "Email",
      ok: emailOk,
      fieldId: "f-email",
      value: input.email?.trim()
        ? input.email
        : input.in_person_signing
          ? "waived — in-person signing"
          : "— required unless in-person signing",
    },
  ];

  const missing = items.filter((i) => !i.ok);
  return { items, ready: missing.length === 0, missing };
}

export function gateFromLead(
  lead: LeadRow,
  extras: { phone?: string | null; email?: string | null; inPerson?: boolean },
) {
  const location = (lead.description ?? "")
    .split("\n")
    .filter((l) => !l.startsWith("[in-person"))
    .join(" ")
    .trim();

  return evaluateGate({
    first_name: lead.person?.first_name ?? lead.raw_name?.split(" ")[0],
    last_name: lead.person?.last_name ?? lead.raw_name?.split(" ").slice(-1)[0],
    case_type_code: lead.case_type_code,
    incident_date: lead.incident_date,
    location,
    phone_digits: extras.phone ?? lead.raw_phone,
    email: extras.email ?? lead.raw_email,
    in_person_signing: extras.inPerson,
  });
}

export function formToGate(input: LeadFormInput) {
  return evaluateGate({
    first_name: input.first_name,
    last_name: input.last_name,
    case_type_code: input.case_type_code,
    incident_date: input.incident_date,
    location: input.location,
    phone_digits: input.phone_digits,
    email: input.email,
    in_person_signing: input.in_person_signing,
  });
}
