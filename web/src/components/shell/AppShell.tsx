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
};

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
  "/owner": [
    { href: "/owner", label: "Dashboard" },
    { href: "/owner/approvals", label: "Approvals" },
    { href: "/owner/sol", label: "SOL Watch" },
  ],
  "/demands": [{ href: "/demands", label: "Demand queue (skeleton)" }],
  "/liens": [{ href: "/liens", label: "Lien worklist (skeleton)" }],
  "/review": [{ href: "/review", label: "Senior review (skeleton)" }],
};

function navForPath(pathname: string): NavItem[] {
  const key = Object.keys(NAV_BY_PREFIX).find((p) => pathname.startsWith(p));
  return NAV_BY_PREFIX[key ?? "/cases"] ?? NAV_BY_PREFIX["/cases"];
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
  const nav = navForPath(pathname);
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

      <aside className="sticky top-[68px] h-[calc(100vh-68px)] overflow-auto border-r border-grid bg-sidebar p-4 text-sidebar-ink">
        <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          Workspace
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            if (item.locked) {
              return (
                <span
                  key={item.href}
                  title={item.lockReason}
                  className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 opacity-70"
                >
                  <span>{item.label}</span>
                  <span aria-hidden>🔒</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2.5 no-underline ${
                  active
                    ? "bg-accent-lt font-bold text-accent-dk"
                    : "text-sidebar-ink hover:bg-accent-lt hover:text-accent-dk"
                }`}
              >
                {item.label}
              </Link>
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
        <main className="min-w-0 flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
