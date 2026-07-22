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
