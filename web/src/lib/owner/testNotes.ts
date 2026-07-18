/** Structured checklist from docs/TESTNOTES.md — keep in sync when that doc changes. */

export type StepResult = "pass" | "fail" | "skip" | "";

export type TestStep = {
  id: string;
  label: string;
  /** Optional in-app path to open while testing */
  href?: string;
};

export type TestSection = {
  id: string;
  title: string;
  minutes?: string;
  intro?: string;
  steps: TestStep[];
  overallPrompt?: string;
};

export const TEST_NOTES_META = {
  title: "Owner test notes",
  purpose:
    "Walk through the demo once, check boxes, jot notes. Pair with OWNER_PROJECT_AUDIT and PHASE7_SCREEN_PROPOSALS.",
  appUrl: "http://127.0.0.1:3000",
  loginHint: "michael@tuttlelawfirm.com (password from Brett / Supabase Auth)",
  dataNote:
    "Fictional seeds only (e.g. Rosa Delgado, Chinedu Okafor). No real client PHI.",
  sourceDoc: "docs/TESTNOTES.md",
} as const;

export const TEST_PREFLIGHT: TestStep[] = [
  {
    id: "pre-dev",
    label: "Brett confirmed npm run dev is running from web/ and the app URL loads",
    href: "/",
  },
  {
    id: "pre-login",
    label: "You can sign in with your attorney account",
  },
  {
    id: "pre-home",
    label: "After login you land on Owner (/owner)",
    href: "/owner",
  },
];

export const TEST_SECTIONS: TestSection[] = [
  {
    id: "shell",
    title: "1. Shell & basics",
    minutes: "~5 min",
    steps: [
      {
        id: "1.1",
        label:
          "Top nav: Owner, Cases, Litigation, Intake (and Demands / Liens / Review if shown)",
      },
      {
        id: "1.2",
        label: "Theme toggle (Parchment / Midnight) if available",
      },
      {
        id: "1.3",
        label: "Global search — type a demo name (e.g. Delgado)",
        href: "/search?q=Delgado",
      },
      {
        id: "1.4",
        label: "Dates on screen look like MM/DD/YYYY (not day-first)",
      },
    ],
    overallPrompt: "Overall shell",
  },
  {
    id: "owner",
    title: "2. Owner dashboard",
    minutes: "~10 min",
    steps: [
      {
        id: "2.1",
        label: "/owner — stalled / attention areas make sense at a glance",
        href: "/owner",
      },
      {
        id: "2.2",
        label: "/owner/approvals — opens without error",
        href: "/owner/approvals",
      },
      {
        id: "2.3",
        label: "/owner/sol — SOL Watch loads",
        href: "/owner/sol",
      },
      {
        id: "2.4",
        label:
          "/owner/calendar — scaffold only; no live Outlook/Google (expected)",
        href: "/owner/calendar",
      },
      {
        id: "2.5",
        label: "/owner/migration — CasePeer status page loads (read-only)",
        href: "/owner/migration",
      },
    ],
    overallPrompt: "Owner overall",
  },
  {
    id: "cm",
    title: "3. Case Manager",
    minutes: "~15 min",
    steps: [
      {
        id: "3.1",
        label: "/cases — caseload lists demo matters",
        href: "/cases",
      },
      {
        id: "3.2",
        label: "Open Rosa Delgado (or another seeded matter)",
        href: "/cases",
      },
      {
        id: "3.3",
        label: "Matter page: stage / tasks / follow-up feel usable",
      },
      {
        id: "3.4",
        label:
          "Coverage / PD / records / demand cards show demo data where seeded",
      },
      {
        id: "3.5",
        label:
          "/cases/calls — Provider Calls page loads; add or view a log if comfortable",
        href: "/cases/calls",
      },
      {
        id: "3.6",
        label: "/cases/tasks — task list loads",
        href: "/cases/tasks",
      },
    ],
    overallPrompt: "CM overall",
  },
  {
    id: "lit",
    title: "4. Litigation + CM↔Lit switcher",
    minutes: "~10 min",
    steps: [
      {
        id: "4.1",
        label: "/litigation — lit caseload loads",
        href: "/litigation",
      },
      {
        id: "4.2",
        label: "Open a lit matter (Delgado / Okafor if present)",
        href: "/litigation",
      },
      {
        id: "4.3",
        label: "Deadlines / tasks areas load",
        href: "/litigation/deadlines",
      },
      {
        id: "4.4",
        label:
          "On a shared matter: use CM ↔ Litigation switcher — lands on the other workspace for same client",
      },
      {
        id: "4.5",
        label: "Identity banner (who you are / role) still clear after switch",
      },
    ],
    overallPrompt: "Lit overall",
  },
  {
    id: "intake",
    title: "5. Intake",
    minutes: "~10 min",
    intro:
      "“Mark contract sent” does not email or e-sign yet — status stub only. Real electronic send is a later vendor decision.",
    steps: [
      {
        id: "5.1",
        label: "/intake — lead queue loads",
        href: "/intake",
      },
      {
        id: "5.2",
        label: "/intake/new — create a test lead (fake name/phone/DOI)",
        href: "/intake/new",
      },
      {
        id: "5.3",
        label: "Open the lead → Mark contract sent → status updates",
      },
      {
        id: "5.4",
        label: "Mark signed → status updates",
      },
      {
        id: "5.5",
        label: "Open matter → you land on /cases/[id] for that matter",
      },
      {
        id: "5.6",
        label: "Optional: open a seed lead and skim contact attempts",
        href: "/intake",
      },
    ],
    overallPrompt: "Intake overall",
  },
  {
    id: "phase7",
    title: "6. Phase 7 queues — look only",
    minutes: "~5 min",
    intro:
      "Skeletons only. Do not expect Kate / Emily / Daniel action buttons yet — those wait on PHASE7_SCREEN_PROPOSALS sign-off.",
    steps: [
      {
        id: "6.1",
        label: "/demands loads (empty list is OK)",
        href: "/demands",
      },
      {
        id: "6.2",
        label: "/liens loads (empty list is OK)",
        href: "/liens",
      },
      {
        id: "6.3",
        label: "/review loads (empty list is OK)",
        href: "/review",
      },
      {
        id: "6.4",
        label:
          "Read Phase 7 screen proposals and mark Approved / Notes / Rework (ask Brett for the doc if needed)",
      },
    ],
  },
];

export const OUT_OF_SCOPE = [
  {
    item: "Live e-sign / DocuSign send from Intake",
    status: "Not built — stub status only",
  },
  { item: "AI / OCR on medicals", status: "Deferred (your decision)" },
  {
    item: "Live Outlook / Google calendar sync",
    status: "Deferred (your decision)",
  },
  {
    item: "Full mockup parity (every card / pizza tracker / discovery)",
    status: "Incremental after this review",
  },
  {
    item: "Real CasePeer client load",
    status: "Owner-run later; needs BAA",
  },
] as const;

export const STORAGE_KEY = "tuttle-owner-test-notes-v1";

export type TestNotesState = {
  steps: Record<string, { result: StepResult; note: string }>;
  sectionNotes: Record<string, string>;
  verdict: {
    date: string;
    overall: "" | "approved" | "approved_notes" | "pause";
    biggestGap: string;
    nextPriority: "" | "deepen" | "phase7" | "casepeer" | "other";
    nextOther: string;
    bugs: string;
  };
};

export function emptyTestNotesState(): TestNotesState {
  return {
    steps: {},
    sectionNotes: {},
    verdict: {
      date: "",
      overall: "",
      biggestGap: "",
      nextPriority: "",
      nextOther: "",
      bugs: "",
    },
  };
}
