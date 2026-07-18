import { test, expect } from "@playwright/test";
import { evaluateGate } from "../src/lib/intake/gate";
import {
  digitsOnly,
  formatPhoneDisplay,
  isPhoneComplete,
  phoneForStorage,
} from "../src/lib/intake/phone";
import { formatDate } from "../src/lib/dates";
import { estimateSolPreview } from "../src/lib/intake/sol";

test.describe("Intake unit helpers", () => {
  test("gate blocks missing email unless in-person", () => {
    const blocked = evaluateGate({
      first_name: "Rosa",
      last_name: "Delgado",
      case_type_code: "auto",
      incident_date: "2025-07-02",
      location: "San Antonio",
      phone_digits: "2105550187",
      email: "",
      in_person_signing: false,
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.missing.map((m) => m.key)).toContain("email");
    expect(blocked.missing.find((m) => m.key === "email")?.fieldId).toBe(
      "f-email",
    );

    const waived = evaluateGate({
      first_name: "Rosa",
      last_name: "Delgado",
      case_type_code: "auto",
      incident_date: "2025-07-02",
      location: "San Antonio",
      phone_digits: "2105550187",
      email: "",
      in_person_signing: true,
    });
    expect(waived.ready).toBe(true);
  });

  test("US/MX phone format + 10-digit gate", () => {
    expect(digitsOnly("(210) 555-0187")).toBe("2105550187");
    expect(isPhoneComplete("2105550187")).toBe(true);
    expect(isPhoneComplete("210555")).toBe(false);
    expect(formatPhoneDisplay("US", "2105550187")).toBe("(210) 555-0187");
    expect(formatPhoneDisplay("MX", "5512345678")).toBe("55 1234 5678");
    expect(phoneForStorage("US", "2105550187")).toBe("+12105550187");
    expect(phoneForStorage("MX", "5512345678")).toBe("+525512345678");
  });

  test("dates always include year; SOL preview tagged", () => {
    const label = formatDate("2025-07-02");
    expect(label).toMatch(/2025/);
    expect(label).not.toMatch(/^\d{1,2}\/\d{1,2}$/);
    const sol = estimateSolPreview("2025-07-02");
    expect(sol?.label).toMatch(/2027/);
    expect(sol?.label).toContain("ATTORNEY-VERIFY");
  });
});
