import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import { ImageDetailWorkspace } from "./image-detail-workspace.tsx";
import { UploadsFrame } from "./uploads-frame.tsx";

// The page for one image: how it looks, what it is for, and whether it can be used. The image is
// loaded in the browser with the creator's own session.
export function ImageDetailSurface({
  assetId,
  navigation,
}: {
  readonly assetId: string;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <UploadsFrame
      heading="Image"
      intro="An image you uploaded. It stays private to you until you use it in a collection."
      navigation={navigation}
    >
      <ImageDetailWorkspace assetId={assetId} />
    </UploadsFrame>
  );
}
