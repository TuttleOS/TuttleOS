export type WhatsNewItem = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

export type VersionUpdate = {
  id: string;
  dateLabel: string;
  title: string;
  summary: string;
  items: WhatsNewItem[];
  /** Step-by-step smoke test for reviewers (shown on /updates). */
  howToTest?: string[];
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

/** Browser-local review state for a Version updates release. */
export type ReleaseReviewState = {
  vote: ReleaseReviewVote;
  happy: boolean;
  notes: string;
  screenshots: ReleaseReviewScreenshot[];
  updatedAt: string | null;
};

export const EMPTY_RELEASE_REVIEW: ReleaseReviewState = {
  vote: null,
  happy: false,
  notes: "",
  screenshots: [],
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
      "All five CM assembly-line queues are on a preview branch — not live on production yet. Use the links below to try them.",
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
