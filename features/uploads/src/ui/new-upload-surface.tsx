import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { NewUploadWorkspace } from "./new-upload-workspace.tsx";
import { UploadsFrame } from "./uploads-frame.tsx";

// The page that adds an image: pick what it is for, choose a file, and see it checked.
export function NewUploadSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <UploadsFrame
      heading="Upload an image"
      intro="Choose what the image is for, then pick a file. It is checked and resized on the server, and it stays private to you until you use it in a collection."
      navigation={navigation}
    >
      <NewUploadWorkspace />
    </UploadsFrame>
  );
}
