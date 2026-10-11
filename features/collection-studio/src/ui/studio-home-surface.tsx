import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { StudioFrame } from "./studio-frame.tsx";
import { StudioHomeWorkspace } from "./studio-home-workspace.tsx";

// The studio's front page: where the person stands as a creator, what they have, and the one thing to do
// next. A server component; the data loads in the browser, in separate parts.
export function StudioHomeSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <StudioFrame
      heading="Creator studio"
      intro="Everything you are building, in one place. Nothing here is published, and nothing is sent to a chain."
      navigation={navigation}
    >
      <StudioHomeWorkspace />
    </StudioFrame>
  );
}
