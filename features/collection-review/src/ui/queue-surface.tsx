import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import { AdminFrame } from "./admin-frame.tsx";
import { ReviewQueue } from "./review-queue.tsx";

// The staff page listing submissions. A server component: everything interactive lives behind the
// queue's client boundary.
export function QueueSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AdminFrame
      heading="Collection reviews"
      intro="Submitted collections waiting for a decision. Nothing here publishes or deploys anything."
      navigation={navigation}
    >
      <ReviewQueue />
    </AdminFrame>
  );
}
