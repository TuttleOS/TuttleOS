export type WhatsNewItem = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

/** Structured testing guide shown on /updates (Michael / staff smoke tests). */
export type TestingGuideQueueRow = {
  queue: string;
  shows: string;
  opens: string;
  clearsWhen: string;
};

export type TestingGuide = {
  /** Short status line under the Testing guide heading */
  statusNote?: string;
  /** What is live vs preview */
  liveVsPreview?: string[];
  queuesIntro?: string;
  queues?: TestingGuideQueueRow[];
  /** Extra bullets (deep-link rule, no schema, etc.) */
  rules?: string[];
  walkthroughTitle?: string;
  walkthrough?: string[];
  afterHappy?: string;
};

export type VersionUpdate = {
  id: string;
  dateLabel: string;
  title: string;
  summary: string;
  items: WhatsNewItem[];
  /** Step-by-step smoke test (simple list; optional if testingGuide.walkthrough is set). */
  howToTest?: string[];
  /** Rich testing guide (tables + walkthrough) for Version updates. */
  testingGuide?: TestingGuide;
};

/** Stable Vercel preview for branch `cm-work-queues` (not production). */
export const CM_WORK_QUEUES_PREVIEW_BASE =
  "https://tuttle-os-git-cm-work-queues-tuttle-os.vercel.app";

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export type ReleaseReviewVote = "up" | "down" | null;

export type ReleaseReviewScreenshot = {
  name: string;
  dataUrl: string;
};

/** Per feature / queue link under a release. */
export type ItemReviewState = {
  vote: ReleaseReviewVote;
  notes: string;
};

/** Browser-local review state for a Version updates release. */
export type ReleaseReviewState = {
  vote: ReleaseReviewVote;
  happy: boolean;
  notes: string;
  screenshots: ReleaseReviewScreenshot[];
  /** Keyed by item title */
  items: Record<string, ItemReviewState>;
  updatedAt: string | null;
};

export const EMPTY_ITEM_REVIEW: ItemReviewState = {
  vote: null,
  notes: "",
};

export const EMPTY_RELEASE_REVIEW: ReleaseReviewState = {
  vote: null,
  happy: false,
  notes: "",
  screenshots: [],
  items: {},
  updatedAt: null,
};

export function releaseReviewStorageKey(releaseId: string): string {
  return `tuttleos.versionReview.${releaseId}`;
}

/** Newest first — used by What’s New modal (current) and /updates history. */
export const VERSION_UPDATES: VersionUpdate[] = [
  {
    id: "2026-07-22-cm-work-queues-preview",
    dateLabel: "07/22/2026",
    title: "CM work queues — preview (all five)",
    summary:
      "Five Case Manager assembly-line queues (derived rows, live counts, deep-links). Queues live on the preview branch — not merged to production yet. Use the Testing guide below, then record your review.",
    testingGuide: {
      statusNote:
        "Built July 22, 2026 on branch cm-work-queues. Production Version updates can open these links; the queue tabs themselves are only on the preview until we merge.",
      liveVsPreview: [
        "Production (live app): Version updates + these preview links — not the five queue tabs yet.",
        "Preview: the actual New cases / LORs / Liability / PD / Records tabs. Sign in with your usual staff account; Vercel may ask for SSO first.",
      ],
      queuesIntro:
        "Tabs sit next to My Caseload / Provider Calls / My Tasks. Each shows a live count. Rows are derived — nobody adds or removes them by hand. A healthy case appears in no queue.",
      queues: [
        {
          queue: "New cases",
          shows: "Assigned to you; sign-up checklist not started yet",
          opens: "Checklist card",
          clearsWhen: "First checklist work is done",
        },
        {
          queue: "LORs pending",
          shows: "Incomplete Send-LOR checklist tasks",
          opens: "Insurance & claims",
          clearsWhen: "You enter LOR sent date on the claim",
        },
        {
          queue: "Liability pending",
          shows: "Liability claims still status open",
          opens: "Insurance & claims",
          clearsWhen: "You set accepted / disputed / denied (etc.)",
        },
        {
          queue: "PD pending",
          shows: "Unresolved property-damage claims",
          opens: "PD card",
          clearsWhen: "You mark PD resolved (or N/A)",
        },
        {
          queue: "Records pending",
          shows: "Outstanding records / bills requests",
          opens: "Records card",
          clearsWhen: "You mark the request received",
        },
      ],
      rules: [
        "Deep-link (rule 12a): clicking a row expands the right card, scrolls to it, and briefly highlights it — not just the top of the case.",
        "No database schema changes for this slice — queues read existing tables/views.",
        "Your review below (thumbs, notes, screenshots) saves in this browser only for now.",
      ],
      walkthroughTitle: "10-minute walkthrough (as a Case Manager)",
      walkthrough: [
        "Open Preview home (link above) → sign in.",
        "Confirm the five new tabs appear with count badges.",
        "New cases → click a row → checklist expands and flashes.",
        "LORs → open a row → enter LOR sent date → refresh queue → row gone.",
        "Liability → change claim status off open → refresh → row gone.",
        "PD → Mark resolved → refresh → row gone.",
        "Records → Mark received → refresh → row gone.",
        "Thumbs up, check Happy with testing, add a note if anything felt off.",
      ],
      afterHappy:
        "When you are happy, tell Brett to merge cm-work-queues into main so the queues go live on the real app.",
    },
    howToTest: [
      "Open the Preview home link (Vercel may ask for SSO). Sign in as a case manager.",
      "Confirm the sidebar shows New cases, LORs, Liability, PD, and Records pending — each with a live count badge.",
      "New cases: open a row → checklist card expands, scrolls into view, and briefly highlights.",
      "LORs pending: open a row → Insurance card; enter an LOR sent date → refresh queue → that row is gone.",
      "Liability pending: open a row → set claim status away from open → refresh → row gone.",
      "PD pending: open a row → Mark resolved on the PD card → refresh → row gone.",
      "Records pending: open a row → mark Received → refresh → row gone.",
      "When everything above works, thumbs-up, check “Happy with testing,” and add notes/screenshots if anything felt off.",
    ],
    items: [
      {
        title: "Preview home (branch cm-work-queues)",
        body: "Vercel preview for this work. Sign in with your usual staff account. If Vercel asks for SSO, use the firm’s Vercel access.",
        href: CM_WORK_QUEUES_PREVIEW_BASE,
        hrefLabel: "Open preview",
      },
      {
        title: "New cases queue",
        body: "Cases assigned to you whose sign-up checklist has not started. Click a client to land on the checklist card (expanded + highlighted).",
        href: `${CM_WORK_QUEUES_PREVIEW_BASE}/cases/new-cases`,
        hrefLabel: "Open New cases",
      },
      {
        title: "LORs pending queue",
        body: "Incomplete Send-LOR checklist tasks. Enter the LOR sent date on the claim card — the row leaves the queue on refresh.",
        href: `${CM_WORK_QUEUES_PREVIEW_BASE}/cases/lors`,
        hrefLabel: "Open LORs pending",
      },
      {
        title: "Liability pending queue",
        body: "Liability claims still status open. Set liability accepted / disputed / denied on Insurance & claims — row leaves the queue.",
        href: `${CM_WORK_QUEUES_PREVIEW_BASE}/cases/liability`,
        hrefLabel: "Open Liability pending",
      },
      {
        title: "PD pending queue",
        body: "Unresolved property-damage claims. Mark resolved on the PD card.",
        href: `${CM_WORK_QUEUES_PREVIEW_BASE}/cases/pd`,
        hrefLabel: "Open PD pending",
      },
      {
        title: "Records pending queue",
        body: "Outstanding medical records / bills requests. Mark received on the Records card.",
        href: `${CM_WORK_QUEUES_PREVIEW_BASE}/cases/records`,
        hrefLabel: "Open Records pending",
      },
    ],
  },
  {
    id: "2026-07-19-documents-storage",
    dateLabel: "07/19/2026",
    title: "Case document upload (storage only)",
    summary:
      "Upload and version case files on the Case Manager matter page. No AI/OCR.",
    howToTest: [
      "Open Cases → pick a matter → expand Case documents.",
      "Upload a small PDF or image; confirm it appears in the list.",
      "Open / preview the file; confirm access log records the open.",
      "Optional: supersede with a new version, then soft-delete.",
    ],
    items: [
      {
        title: "Case documents panel",
        body: "On a matter under Case Manager, open Case documents to upload files, view/download, supersede with a new version, and soft-delete. Access log records who opened which file.",
        href: "/cases",
        hrefLabel: "Open Cases",
      },
      {
        title: "No AI yet",
        body: "OCR, summarize, and extract stay off. This is Storage + workflow.document metadata only.",
      },
    ],
  },
  {
    id: "2026-07-19-c2-esign",
    dateLabel: "07/19/2026",
    title: "Contingent fee e-sign & multi-person intake",
    summary:
      "Shared contract signing, firm countersign, companions on New Lead, searchable co-signers.",
    howToTest: [
      "Create or open a lead with email; draft / send a contingent fee contract.",
      "Open the public sign link; draw + type a signature as the client.",
      "As attorney/admin, countersign; confirm PDF can be viewed/printed.",
      "On New Lead, add a companion; confirm both people share one signing package when co-signed.",
    ],
    items: [
      {
        title: "Contingent fee e-sign",
        body: "Compose a shared contract, send one public link, and collect drawn + typed signatures from every party. PDF files only when everyone has signed.",
        href: "/intake",
        hrefLabel: "Open Intake",
      },
      {
        title: "Firm countersign, view & print",
        body: "Attorneys/admins can countersign for the firm on the live contract page, then Print or Download PDF.",
      },
      {
        title: "Multi-person New Lead",
        body: "On New Lead, add companions with name, email, and optional DOB. Each person gets their own lead on the same crash.",
        href: "/intake/new",
        hrefLabel: "New lead",
      },
      {
        title: "Searchable companion linkers",
        body: "On the contract panel, search leads by name/email/phone to add co-signers — no long checkbox lists. Preview the merged contract before send.",
      },
    ],
  },
];

/** Bump when you want everyone to see What’s New again after login. */
export const WHATS_NEW_ID =
  VERSION_UPDATES[0]?.id ?? "2026-07-19-documents-storage";

export const WHATS_NEW_STORAGE_KEY = `tuttleos.whatsNew.dismissed.${WHATS_NEW_ID}`;

export const WHATS_NEW_ITEMS: WhatsNewItem[] =
  VERSION_UPDATES[0]?.items ?? [];
