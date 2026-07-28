import { VersionUpdatesList } from "@/components/updates/VersionUpdatesList";
import { ProjectMap } from "@/components/updates/ProjectMap";
import { VERSION_UPDATES } from "@/lib/whatsNew";

export default function VersionUpdatesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-ink">Version updates</h1>
      <p className="mt-2 text-sm text-muted">
        Start with the{" "}
        <a
          href="#project-map"
          className="font-semibold text-accent-dk hover:underline"
        >
          Project map
        </a>{" "}
        — how workspaces and roles connect — then review release notes below
        (testing guides, thumbs, notes, screenshots). The same release list
        powers the login What’s New popup.
      </p>

      <div className="mt-6">
        <ProjectMap />
      </div>

      <h2 className="mt-10 text-lg font-bold text-ink">Release notes</h2>
      <p className="mt-1 text-sm text-muted">
        Newest first. Current releases include a testing guide and your local
        review panel.
      </p>
      <VersionUpdatesList releases={VERSION_UPDATES} />
    </div>
  );
}
