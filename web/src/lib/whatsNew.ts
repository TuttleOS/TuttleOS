/** Bump `id` when you want everyone to see What’s New again after login. */
export const WHATS_NEW_ID = "2026-07-19-c2-esign";

export const WHATS_NEW_STORAGE_KEY = `tuttleos.whatsNew.dismissed.${WHATS_NEW_ID}`;

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
};

/** Newest first — used by What’s New modal (current) and /updates history. */
export const VERSION_UPDATES: VersionUpdate[] = [
  {
    id: "2026-07-19-c2-esign",
    dateLabel: "07/19/2026",
    title: "Contingent fee e-sign & multi-person intake",
    summary:
      "Shared contract signing, firm countersign, companions on New Lead, searchable co-signers.",
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

export const WHATS_NEW_ITEMS: WhatsNewItem[] =
  VERSION_UPDATES[0]?.items ?? [];
