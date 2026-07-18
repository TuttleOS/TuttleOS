/** Owner walkthrough copy — plain language for Michael. Keep docs/TESTNOTES.md aligned. */

export type StepResult = "pass" | "fail" | "skip" | "";

export type TestStep = {
  id: string;
  /** Short plain title */
  label: string;
  /** What to click / do */
  how?: string;
  /** What “good” looks like */
  expect?: string;
  /** In-app link */
  href?: string;
  /** Friendly link button text */
  linkLabel?: string;
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
  title: "Michael’s walkthrough checklist",
  purpose:
    "This is a guided tour of Tuttle OS. Work top to bottom. For each step, mark Looks good, Problem, or Skip for now — then add a short note if something was wrong or confusing.",
  howLong: "About 45–60 minutes. You can stop and come back; your answers stay on this computer.",
  loginHint:
    "Sign in with michael@tuttlelawfirm.com (ask Brett for the password if you need it).",
  dataNote:
    "Everything you see is practice / fake data (names like Rosa Delgado). Do not use real client information.",
  tip: "Use the blue “Open …” buttons to jump to each screen in a new tab. Keep this checklist tab open so you can mark answers as you go.",
} as const;

export const TEST_PREFLIGHT: TestStep[] = [
  {
    id: "pre-dev",
    label: "The website opens",
    how: "Ask Brett for the link (local demo or the live site). Open it in Chrome or Safari.",
    expect: "You see a login page or the app — not a blank error page.",
    href: "/",
    linkLabel: "Open the home / login page",
  },
  {
    id: "pre-login",
    label: "You can sign in",
    how: "Enter your email and password, then click Sign in.",
    expect: "You get into the app without an error message.",
  },
  {
    id: "pre-home",
    label: "You start on the Owner home screen",
    how: "After signing in, look at the left menu and the main page.",
    expect:
      "The left menu shows Owner items (Dashboard, Approvals, SOL Watch, etc.) and the main page is your firm overview — not Intake or Cases only.",
    href: "/owner",
    linkLabel: "Open Owner home",
  },
];

export const TEST_SECTIONS: TestSection[] = [
  {
    id: "shell",
    title: "1. Getting around the app",
    minutes: "About 5 minutes",
    intro:
      "This section is only about finding your way around — menus, search, and how dates look.",
    steps: [
      {
        id: "1.1",
        label: "Left menu makes sense",
        how: "Look at the list on the left. Click a few items (Owner, Cases, Litigation, Intake). Demands, Liens, and Review may also appear.",
        expect:
          "Each click opens a different work area. Nothing crashes. You can always get back using the left menu.",
      },
      {
        id: "1.2",
        label: "Light / dark look (optional)",
        how: "Near your name at the top right, click the ◐ button if you see it.",
        expect:
          "The page switches between a light look and a darker look. Either is fine — this is preference only.",
      },
      {
        id: "1.3",
        label: "Search finds a practice client",
        how: "Use the search box near the top of the page. Type Delgado (or another name from the demo).",
        expect:
          "You get a result you can click, or a search results page with that person. If nothing appears, mark Problem and tell Brett.",
        href: "/search?q=Delgado",
        linkLabel: "Try search for Delgado",
      },
      {
        id: "1.4",
        label: "Dates look American-style",
        how: "On any list or case page, glance at dates (accident date, deadlines, follow-ups).",
        expect:
          "Dates look like 07/18/2026 (month / day / year) — not day-first like 18/07/2026.",
      },
    ],
    overallPrompt: "How does getting around feel overall?",
  },
  {
    id: "owner",
    title: "2. Your Owner screens (attorney view)",
    minutes: "About 10 minutes",
    intro:
      "These are the screens meant for you as attorney / firm owner — what needs attention across the firm.",
    steps: [
      {
        id: "2.1",
        label: "Owner dashboard",
        how: "Left menu → Dashboard (or use the button below).",
        expect:
          "You see a firm overview: things that may be stalled, waiting on you, or worth a look. It does not need to be perfect — does it feel useful at a glance?",
        href: "/owner",
        linkLabel: "Open Owner dashboard",
      },
      {
        id: "2.2",
        label: "Approvals",
        how: "Left menu → Approvals.",
        expect:
          "The page opens. You may see items waiting for attorney approval, or an empty list. Empty is OK for practice data.",
        href: "/owner/approvals",
        linkLabel: "Open Approvals",
      },
      {
        id: "2.3",
        label: "SOL Watch (statute of limitations)",
        how: "Left menu → SOL Watch.",
        expect:
          "You see a list aimed at catching cases with approaching filing deadlines. Empty list is OK if there is no practice SOL data.",
        href: "/owner/sol",
        linkLabel: "Open SOL Watch",
      },
      {
        id: "2.4",
        label: "Calendar sync (preview only)",
        how: "Left menu → Calendar sync.",
        expect:
          "A settings-style page opens. It should NOT connect to your real Outlook or Google calendar yet — that is turned off on purpose until you say go.",
        href: "/owner/calendar",
        linkLabel: "Open Calendar sync",
      },
      {
        id: "2.5",
        label: "CasePeer migration status",
        how: "Left menu → Migration.",
        expect:
          "A status page about moving cases from CasePeer later. You are only looking — you do not need to run anything. Empty / early numbers are fine.",
        href: "/owner/migration",
        linkLabel: "Open Migration status",
      },
    ],
    overallPrompt: "Owner area overall — good enough to keep building this way?",
  },
  {
    id: "cm",
    title: "3. Case Manager (pre-litigation cases)",
    minutes: "About 15 minutes",
    intro:
      "This is the day-to-day case file for cases that are not (yet) in lawsuit mode — what your case managers will live in.",
    steps: [
      {
        id: "3.1",
        label: "Case list opens",
        how: "Left menu → click into Cases / My Caseload (or use the button).",
        expect: "You see a list of practice cases (not a crash or blank error).",
        href: "/cases",
        linkLabel: "Open case list",
      },
      {
        id: "3.2",
        label: "Open a practice case",
        how: "Click Rosa Delgado if you see her, or any other name on the list.",
        expect: "A full case page opens for that client.",
        href: "/cases",
        linkLabel: "Open case list again",
      },
      {
        id: "3.3",
        label: "Case page feels usable",
        how: "Scroll the case page. Look for stage, tasks, follow-up date, and notes-style areas.",
        expect:
          "You can tell where the case is and what work is pending. It does not need every feature from CasePeer yet — does the layout feel workable?",
      },
      {
        id: "3.4",
        label: "Insurance / property damage / records / demand sections",
        how: "On the same case page, look for boxes or sections about coverage (insurance), property damage, medical records, and demand / negotiation.",
        expect:
          "Some practice data may already be filled in. Missing pieces are OK — mark Problem only if the page looks broken or confusing.",
      },
      {
        id: "3.5",
        label: "Provider Calls",
        how: "In the Cases left menu, click Provider Calls. Optionally add a short practice call note.",
        expect:
          "The page opens. You can see a list of provider follow-ups (may be empty).",
        href: "/cases/calls",
        linkLabel: "Open Provider Calls",
      },
      {
        id: "3.6",
        label: "My Tasks (case side)",
        how: "Cases left menu → My Tasks.",
        expect: "A task list opens (may be empty or short with practice data).",
        href: "/cases/tasks",
        linkLabel: "Open case tasks",
      },
    ],
    overallPrompt: "Case Manager overall — close to what you need day to day?",
  },
  {
    id: "lit",
    title: "4. Litigation (lawsuit side) + switching views",
    minutes: "About 10 minutes",
    intro:
      "Same client can have a Case Manager view and a Litigation view. You should be able to jump between them without losing which client you are on.",
    steps: [
      {
        id: "4.1",
        label: "Litigation case list",
        how: "Left menu → Litigation / My Cases.",
        expect: "A list of lawsuit-side practice cases opens.",
        href: "/litigation",
        linkLabel: "Open litigation list",
      },
      {
        id: "4.2",
        label: "Open a litigation case",
        how: "Click Delgado, Okafor, or any case on that list.",
        expect: "A litigation case page opens (court / deadlines / tasks style content).",
        href: "/litigation",
        linkLabel: "Open litigation list again",
      },
      {
        id: "4.3",
        label: "Deadlines and litigation tasks",
        how: "From the Litigation left menu, open Deadline Horizon and My Tasks.",
        expect: "Both pages open without errors. Lists may be short or empty.",
        href: "/litigation/deadlines",
        linkLabel: "Open Deadline Horizon",
      },
      {
        id: "4.4",
        label: "Switch between Case Manager and Litigation",
        how: "On a case that exists in both places, look near the top right for a button that switches Case Manager ↔ Litigation. Click it.",
        expect:
          "You land on the other view for the SAME client (not a random different case).",
      },
      {
        id: "4.5",
        label: "You still know who you are",
        how: "After switching, look for a banner or header that shows your name / role.",
        expect:
          "It is clear you are still signed in as yourself (Michael), even if you are peeking at Case Manager or Litigation screens.",
      },
    ],
    overallPrompt: "Litigation + switching views — clear enough?",
  },
  {
    id: "intake",
    title: "5. Intake (new leads → signed client)",
    minutes: "About 10 minutes",
    intro:
      "Important: “Mark contract sent” does NOT email the client or send a DocuSign yet. It only updates the lead’s status in the system. Real e-sign can come later if you want it.",
    steps: [
      {
        id: "5.1",
        label: "Lead list opens",
        how: "Left menu → Intake / Lead Queue.",
        expect: "You see a list of leads (practice data and/or ones you create).",
        href: "/intake",
        linkLabel: "Open Intake lead list",
      },
      {
        id: "5.2",
        label: "Create a practice lead",
        how: "Click New Lead. Fill in a fake name, phone, and accident date. Save.",
        expect: "The lead is created and you can open it from the list.",
        href: "/intake/new",
        linkLabel: "Open New Lead form",
      },
      {
        id: "5.3",
        label: "Mark contract as sent",
        how: "Open your new lead. Click the button that marks the contract as sent.",
        expect:
          "The lead status changes (for example to “contract out”). No real email needs to go out.",
      },
      {
        id: "5.4",
        label: "Mark as signed",
        how: "On the same lead, click Mark signed (or similar).",
        expect: "Status updates to signed / ready to open a matter.",
      },
      {
        id: "5.5",
        label: "Open the matter (create the case file)",
        how: "Click Open matter (or similar).",
        expect:
          "You are taken to that client’s Case Manager page — a real case file for the new client.",
      },
      {
        id: "5.6",
        label: "Optional: peek at an existing practice lead",
        how: "Back on the Intake list, open any older practice lead and skim call / contact history.",
        expect: "You can read prior attempts without breaking anything.",
        href: "/intake",
        linkLabel: "Back to Intake list",
      },
    ],
    overallPrompt: "Intake flow — good enough for staff rehearsal?",
  },
  {
    id: "phase7",
    title: "6. Demand / Liens / Review queues (look only)",
    minutes: "About 5 minutes",
    intro:
      "These screens are early drafts for Kate (demands), Emily (liens), and Daniel (viability review). Empty lists are normal. Do not expect full action buttons yet — we stop building those until you approve the screen ideas Brett sent.",
    steps: [
      {
        id: "6.1",
        label: "Demand queue",
        how: "Left menu → Demand queue (or use the button).",
        expect: "Page opens. Empty is fine.",
        href: "/demands",
        linkLabel: "Open Demand queue",
      },
      {
        id: "6.2",
        label: "Lien worklist",
        how: "Left menu → Lien worklist.",
        expect: "Page opens. Empty is fine.",
        href: "/liens",
        linkLabel: "Open Lien worklist",
      },
      {
        id: "6.3",
        label: "Viability reviews",
        how: "Left menu → Viability reviews.",
        expect: "Page opens. Empty is fine.",
        href: "/review",
        linkLabel: "Open Viability reviews",
      },
      {
        id: "6.4",
        label: "Approve or rewrite those three screen ideas",
        how: "Ask Brett for the Phase 7 screen proposals (or the owner audit packet). Mark each role Approved / Notes / Rework.",
        expect:
          "You have told Brett whether Kate’s, Emily’s, and Daniel’s proposed screens are the right direction.",
      },
    ],
  },
];

export const OUT_OF_SCOPE = [
  {
    item: "Sending contracts by email / DocuSign from inside the app",
    status: "Not built yet — status button only for now",
  },
  {
    item: "AI reading medical records",
    status: "On hold — you said not yet",
  },
  {
    item: "Live sync to Outlook or Google Calendar",
    status: "On hold — you said not yet",
  },
  {
    item: "Every feature from the clickable mockups / CasePeer",
    status: "We add these in stages after your feedback",
  },
  {
    item: "Loading real CasePeer client files",
    status: "Later, when you approve — and after the privacy agreement (BAA)",
  },
] as const;

export const STORAGE_KEY = "tuttle-owner-test-notes-v2";

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
