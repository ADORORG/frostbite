import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";

import { UploadsWorkspace } from "./uploads-workspace.tsx";

// The studio page for uploads: the shared shell around the client workspace. It is a server
// component; everything interactive lives behind the workspace's client boundary.
export function UploadsSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Uploads beta"
      homeHref="/"
      navigation={navigation}
      notices={[
        "◆ PRIVATE DRAFTS",
        "▲ CHECKED ON THE SERVER",
        "★ NOTHING PUBLISHED",
      ]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Studio</p>
        <h1>Uploads</h1>
        <p>
          Images you upload stay private to you. They are checked and resized on
          the server before they appear below, and nothing is published from
          here.
        </p>
        <UploadsWorkspace />
      </section>
    </AppShell>
  );
}
