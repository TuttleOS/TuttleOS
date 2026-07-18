"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "./GlobalSearch";
import { IdentityBanner } from "./IdentityBanner";
import type { StaffProfile } from "@/lib/staff";
import { displayName } from "@/lib/staff";
import {
  cmLitSwitchAction,
  identityBannerCopy,
} from "@/lib/workspace";

type NavItem = {
  href: string;
  label: string;
  locked?: boolean;
  lockReason?: string;
  /** Call-out styling (e.g. Michael’s walkthrough) */
  featured?: boolean;
  /** Group heading in the sidebar */
  section?: string;
};

/** Full firm menu for attorney / admin / senior PL (Michael’s view). */
const FIRM_WIDE_NAV: NavItem[] = [
  { href: "/owner", label: "Dashboard", section: "Owner" },
  { href: "/owner/approvals", label: "Approvals", section: "Owner" },
  { href: "/owner/sol", label: "SOL Watch", section: "Owner" },
  { href: "/owner/calendar", label: "Calendar", section: "Owner" },
  { href: "/owner/migration", label: "Migration", section: "Owner" },
  { href: "/intake", label: "Lead queue", section: "Intake" },
  { href: "/intake/new", label: "New lead", section: "Intake" },
  { href: "/intake/activity", label: "Activity", section: "Intake" },
  { href: "/cases", label: "Cases", section: "Case Manager" },
  { href: "/cases/calls", label: "Provider calls", section: "Case Manager" },
  { href: "/cases/tasks", label: "Tasks", section: "Case Manager" },
  { href: "/litigation", label: "Cases", section: "Litigation" },
  { href: "/litigation/tasks", label: "Tasks", section: "Litigation" },
  {
    href: "/litigation/deadlines",
    label: "Deadlines",
    section: "Litigation",
  },
  { href: "/demands", label: "Demands", section: "Specialty" },
  { href: "/liens", label: "Liens", section: "Specialty" },
  { href: "/review", label: "Viability", section: "Specialty" },
  { href: "/test", label: "Walkthrough", featured: true },
];

const NAV_BY_PREFIX: Record<string, NavItem[]> = {
  "/intake": [
    { href: "/intake", label: "Lead Queue" },
    { href: "/intake/new", label: "New Lead" },
    { href: "/intake/activity", label: "My Activity" },
    {
      href: "/cases",
      label: "Cases",
      locked: true,
      lockReason: "Restricted — intake tier (medical/litigation blocked in DB)",
    },
    {
      href: "/litigation",
      label: "Litigation",
      locked: true,
      lockReason: "Restricted — intake tier (enforced by the database)",
    },
  ],
  "/cases": [
    { href: "/cases", label: "My Caseload" },
    { href: "/cases/calls", label: "Provider Calls" },
    { href: "/cases/tasks", label: "My Tasks" },
    {
      href: "/cases/financials",
      label: "Financials",
      locked: true,
      lockReason: "Restricted — finance tier",
    },
  ],
  "/litigation": [
    { href: "/litigation", label: "My Cases" },
    { href: "/litigation/tasks", label: "My Tasks" },
    { href: "/litigation/deadlines", label: "Deadline Horizon" },
  ],
  "/owner": FIRM_WIDE_NAV,
  "/demands": [{ href: "/demands", label: "Demand queue" }],
  "/liens": [{ href: "/liens", label: "Lien worklist" }],
  "/review": [{ href: "/review", label: "Viability reviews" }],
};

function usesFirmWideNav(staff: StaffProfile): boolean {
  return (
    staff.is_attorney ||
    staff.role_code === "admin" ||
    staff.role_code === "senior_paralegal"
  );
}

function navForPath(pathname: string, staff: StaffProfile): NavItem[] {
  if (usesFirmWideNav(staff)) {
    return FIRM_WIDE_NAV;
  }
  if (pathname === "/test" || pathname.startsWith("/test/")) {
    return NAV_BY_PREFIX["/owner"];
  }
  const key = Object.keys(NAV_BY_PREFIX).find((p) => pathname.startsWith(p));
  return NAV_BY_PREFIX[key ?? "/cases"] ?? NAV_BY_PREFIX["/cases"];
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/owner") return pathname === "/owner";
  if (href === "/cases") return pathname === "/cases";
  if (href === "/litigation") return pathname === "/litigation";
  if (href === "/intake") return pathname === "/intake";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  staff,
  children,
}: {
  staff: StaffProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navForPath(pathname, staff);
  const name = displayName(staff);
  const switchAction = cmLitSwitchAction(staff, pathname);
  const banner = identityBannerCopy(staff, pathname);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    const root = document.documentElement;
    const next =
      root.getAttribute("data-theme") === "midnight" ? "parchment" : "midnight";
    root.setAttribute("data-theme", next);
    localStorage.setItem("tuttle-theme", next);
  }

  return (
    <div className="grid min-h-screen grid-cols-[248px_1fr] grid-rows-[68px_1fr]">
      <header className="sticky top-0 z-20 col-span-2 grid grid-cols-[248px_1fr_auto] items-center border-b border-grid bg-top text-top-ink">
        <div className="flex h-full items-center gap-2 border-r border-grid px-6">
          <div>
            <div className="font-display text-xl font-bold tracking-wide">
              TUTTLE<span className="ml-1 text-sm text-accent-dk">OS</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted">
              Crash Guy Injury Attorneys
            </div>
          </div>
        </div>
        <div className="px-6">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-3 px-5">
          {switchAction && (
            <Link
              href={switchAction.href}
              className="rounded-lg border border-grid bg-surface px-3 py-1.5 text-xs font-bold no-underline hover:bg-surface-2"
              title="Switch workspace — audits stay under your name"
            >
              {switchAction.label}
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-transparent px-2 py-1.5 text-sm hover:border-grid hover:bg-surface-2"
            title="Toggle theme"
          >
            ◐
          </button>
          <div className="text-right leading-tight">
            <div className="font-semibold">{name}</div>
            <div className="text-xs text-muted">
              {staff.role_code.replaceAll("_", " ")}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-grid px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      </header>

      <aside className="sticky top-[68px] flex h-[calc(100vh-68px)] flex-col border-r border-white/8 bg-sidebar text-sidebar-ink">
        <nav className="flex-1 overflow-auto px-3 py-4">
          {nav.map((item, index) => {
            const active = isNavActive(pathname, item.href);
            const prevSection = index > 0 ? nav[index - 1]?.section : undefined;
            const showSection =
              item.section && item.section !== prevSection
                ? item.section
                : null;
            const isFirstSection = index === 0 || !prevSection;

            const sectionEl = showSection ? (
              <div
                className={`mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 ${
                  isFirstSection ? "mt-0" : "mt-5 border-t border-white/8 pt-4"
                }`}
              >
                {showSection}
              </div>
            ) : null;

            if (item.locked) {
              return (
                <div key={item.href}>
                  {sectionEl}
                  <span
                    title={item.lockReason}
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] text-white/30"
                  >
                    <span>{item.label}</span>
                    <span aria-hidden className="text-[10px]">
                      🔒
                    </span>
                  </span>
                </div>
              );
            }
            if (item.featured) {
              return (
                <div key={item.href} className="mt-6 border-t border-white/8 pt-4">
                  <Link
                    href={item.href}
                    title="Guided tour — start here"
                    className={`block rounded-lg border px-2.5 py-2 text-[13px] font-semibold no-underline transition ${
                      active
                        ? "!border-warning !bg-warning !text-white"
                        : "!border-warning/60 !bg-warning/15 !text-warning hover:!bg-warning hover:!text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </div>
              );
            }
            return (
              <div key={item.href}>
                {sectionEl}
                <Link
                  href={item.href}
                  className={`block rounded-lg px-2.5 py-1.5 text-[13px] no-underline transition ${
                    active
                      ? "!bg-white/12 !font-semibold !text-white"
                      : "!text-white/70 hover:!bg-white/8 hover:!text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col bg-page">
        {banner && (
          <IdentityBanner
            title={banner.title}
            detail={banner.detail}
            backHref={banner.backHref}
            backLabel={banner.backLabel}
          />
        )}
        <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
