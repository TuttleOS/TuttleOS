function WorkspacePlaceholder({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <section className="rounded-panel border border-grid bg-surface p-6 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
        Phase 1 foundation
      </p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{blurb}</p>
    </section>
  );
}

export default function CasesPage() {
  return (
    <WorkspacePlaceholder
      title="Case Manager workspace"
      blurb="Shell is live. Phase 3 will implement the full caseload and case page from mockups/case-manager-workspace-mockup.html."
    />
  );
}
