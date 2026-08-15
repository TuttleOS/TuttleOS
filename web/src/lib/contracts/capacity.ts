/**
 * Call #2 J3 — minor / guardian contract capacity.
 *
 * Case A: guardian is also a client on the crash → minors ride on guardian's contract.
 * Case B: guardian is not a client in the accident → guardian signs the minor's contract only.
 */

export type GuardianContractCase = "A" | "B";

export function formatIndividuallyAndOnBehalfOf(
  adultName: string,
  minorNames: string[],
): string {
  const adult = adultName.trim();
  const minors = minorNames.map((n) => n.trim()).filter(Boolean);
  if (!adult) return minors.join(" and ") || "______________________";
  if (minors.length === 0) return adult;
  if (minors.length === 1) {
    return `${adult}, individually and on behalf of ${minors[0]}, a minor`;
  }
  if (minors.length === 2) {
    return `${adult}, individually and on behalf of ${minors[0]} and ${minors[1]}, minors`;
  }
  const head = minors.slice(0, -1).join(", ");
  const last = minors[minors.length - 1];
  return `${adult}, individually and on behalf of ${head}, and ${last}, minors`;
}

/** Inverse of formatIndividuallyAndOnBehalfOf — used to show both names on the signature page. */
export function parseIndividuallyAndOnBehalfOf(
  names: string,
): { adult: string; minors: string[] } | null {
  const s = names.trim();
  const one =
    /^(.*?),\s*individually and on behalf of\s+(.+?),\s*a minor$/i.exec(s);
  if (one) return { adult: one[1].trim(), minors: [one[2].trim()] };
  const two =
    /^(.*?),\s*individually and on behalf of\s+(.+?)\s+and\s+(.+?),\s*minors$/i.exec(
      s,
    );
  if (two) {
    return {
      adult: two[1].trim(),
      minors: [two[2].trim(), two[3].trim()],
    };
  }
  const many =
    /^(.*?),\s*individually and on behalf of\s+(.+?),\s+and\s+(.+?),\s*minors$/i.exec(
      s,
    );
  if (many) {
    const head = many[2]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return { adult: many[1].trim(), minors: [...head, many[3].trim()] };
  }
  return null;
}

export type VisiblePartyLine = {
  key: string;
  title: string;
  subtitle?: string;
  status: string;
  signed_at: string | null;
};

/** Parties list: guardian + minor on one packet; minor does not draw. */
export function visiblePartyLines(input: {
  clientDisplayNames: string;
  signers: {
    contract_signer_id?: string;
    full_name: string;
    status: string;
    signed_at: string | null;
  }[];
}): VisiblePartyLine[] {
  const split = parseIndividuallyAndOnBehalfOf(input.clientDisplayNames);
  if (!split || input.signers.length === 0) {
    return input.signers.map((s, i) => ({
      key: s.contract_signer_id ?? `s-${i}`,
      title: s.full_name,
      status: s.status,
      signed_at: s.signed_at,
    }));
  }
  const adultLc = split.adult.toLowerCase();
  const guardian =
    input.signers.find((s) => s.full_name.trim().toLowerCase() === adultLc) ??
    input.signers[0];
  const others = input.signers.filter((s) => s !== guardian);
  return [
    {
      key: `${guardian.contract_signer_id ?? "g"}-individually`,
      title: `${split.adult}, individually`,
      status: guardian.status,
      signed_at: guardian.signed_at,
    },
    ...split.minors.map((m, i) => ({
      key: `${guardian.contract_signer_id ?? "g"}-nf-${i}`,
      title: `${m}, a minor`,
      subtitle: `by ${split.adult}, next friend`,
      status: guardian.status,
      signed_at: guardian.signed_at,
    })),
    ...others.map((s, i) => ({
      key: s.contract_signer_id ?? `o-${i}`,
      title: s.full_name,
      status: s.status,
      signed_at: s.signed_at,
    })),
  ];
}

type PdfSignerBlock = {
  full_name: string;
  signed_at: string | null;
  signature_typed_name: string | null;
  signature_data?: string | null;
};

/** Same drawn signature appears under the adult line and each next-friend line. */
export function expandNextFriendSignatureBlocks(
  clientDisplayNames: string,
  signers: PdfSignerBlock[],
): PdfSignerBlock[] {
  const split = parseIndividuallyAndOnBehalfOf(clientDisplayNames);
  if (!split || signers.length === 0) return signers;
  const adultLc = split.adult.toLowerCase();
  const guardian =
    signers.find((s) => s.full_name.trim().toLowerCase() === adultLc) ??
    signers[0];
  const others = signers.filter((s) => s !== guardian);
  return [
    { ...guardian, full_name: `${split.adult}, individually` },
    ...split.minors.map((m) => ({
      ...guardian,
      full_name: `${split.adult}, as next friend of ${m}, a minor`,
    })),
    ...others,
  ];
}

/** Case B helper text (Michael Call #2 wording). */
export const CASE_B_GUARDIAN_HELPER =
  "Minor's guardian/parent is not a client in this accident — the parent/guardian must sign this minor's contract.";

export type MinorWardSummary = {
  intake_lead_id: string;
  person_id: string | null;
  display_name: string;
  not_drivers_child: boolean;
  relationship_to_driver: string | null;
};

export type LeadContractPlan =
  | {
      kind: "adult_with_wards";
      /** Case A minors who ride on this adult's contract */
      wards: MinorWardSummary[];
      clientDisplayNames: string;
      /** Only the adult signs */
      adultSignsAlone: true;
    }
  | {
      kind: "minor_case_a";
      /** Do not send a separate package — open guardian lead instead */
      guardianLeadId: string;
      guardianName: string;
      minorName: string;
      message: string;
    }
  | {
      kind: "minor_case_b";
      guardianName: string;
      minorName: string;
      clientDisplayNames: string;
      helperText: string;
    }
  | {
      kind: "minor_incomplete";
      message: string;
    }
  | {
      kind: "adult_plain";
      clientDisplayNames: string;
    };

export function buildAdultPlainPlan(adultName: string): LeadContractPlan {
  return { kind: "adult_plain", clientDisplayNames: adultName.trim() };
}

export function buildAdultWithWardsPlan(
  adultName: string,
  wards: MinorWardSummary[],
): LeadContractPlan {
  if (!wards.length) return buildAdultPlainPlan(adultName);
  return {
    kind: "adult_with_wards",
    wards,
    clientDisplayNames: formatIndividuallyAndOnBehalfOf(
      adultName,
      wards.map((w) => w.display_name),
    ),
    adultSignsAlone: true,
  };
}

export function buildMinorCaseAPlan(input: {
  guardianLeadId: string;
  guardianName: string;
  minorName: string;
}): LeadContractPlan {
  return {
    kind: "minor_case_a",
    guardianLeadId: input.guardianLeadId,
    guardianName: input.guardianName,
    minorName: input.minorName,
    message: `${input.minorName} rides on ${input.guardianName}'s contract (Case A — guardian is also a client). Open that lead to draft / send. Signature language: “${input.guardianName}, individually and on behalf of ${input.minorName}, a minor.”`,
  };
}

export function buildMinorCaseBPlan(input: {
  guardianName: string;
  minorName: string;
}): LeadContractPlan {
  return {
    kind: "minor_case_b",
    guardianName: input.guardianName,
    minorName: input.minorName,
    clientDisplayNames: formatIndividuallyAndOnBehalfOf(input.guardianName, [
      input.minorName,
    ]),
    helperText: CASE_B_GUARDIAN_HELPER,
  };
}
