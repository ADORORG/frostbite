import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import { LibraryWorkspace } from "./library-workspace.tsx";
import { UploadsFrame } from "./uploads-frame.tsx";

// The library page: the images already added. Everything interactive lives behind the workspace's
// client boundary.
export function UploadsSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <UploadsFrame
      heading="Uploads"
      intro="Images you upload stay private to you. They are checked and resized on the server before they appear below, and nothing is published from here."
      navigation={navigation}
    >
      <LibraryWorkspace />
    </UploadsFrame>
  );
}
