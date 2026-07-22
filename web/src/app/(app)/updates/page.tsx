import { VersionUpdatesList } from "@/components/updates/VersionUpdatesList";
import { VERSION_UPDATES } from "@/lib/whatsNew";

export default function VersionUpdatesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">Version updates</h1>
      <p className="mt-2 text-sm text-muted">
        Release notes for recent Tuttle OS changes. The same list powers the
        login What’s New popup (shown once per release). Use{" "}
        <span className="font-semibold text-ink">How to test</span> and your
        review panel (thumbs, notes, screenshots) while walking a preview.
      </p>

      <VersionUpdatesList releases={VERSION_UPDATES} />
    </div>
  );
}
