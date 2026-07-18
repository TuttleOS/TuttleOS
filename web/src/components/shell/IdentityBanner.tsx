import Link from "next/link";

export function IdentityBanner({
  title,
  detail,
  backHref,
  backLabel,
}: {
  title: string;
  detail: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="border-b border-warning/40 bg-warning-bg px-5 py-2.5 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted">{detail}</p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-lg border border-grid bg-surface px-3 py-1.5 text-xs font-bold no-underline hover:bg-surface-2"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
