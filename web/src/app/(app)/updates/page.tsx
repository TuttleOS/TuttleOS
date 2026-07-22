import { VersionUpdatesList } from "@/components/updates/VersionUpdatesList";
import { VERSION_UPDATES } from "@/lib/whatsNew";

export default function VersionUpdatesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Version updates</h1>
      <p className="mt-2 text-sm text-muted">
        Release notes for recent Tuttle OS changes. Current releases include a{" "}
        <span className="font-semibold text-ink">Testing guide</span> and your
        review panel (thumbs, notes, screenshots). The same list powers the
        login What’s New popup (shown once per release).
      </p>

      <VersionUpdatesList releases={VERSION_UPDATES} />
    </div>
  );
}
