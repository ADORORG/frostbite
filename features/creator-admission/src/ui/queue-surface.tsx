import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame } from "@repo/ui/arcade";

import { ReviewQueue } from "./review-queue.tsx";

// The staff page listing creator applications. A server component: everything interactive lives behind the
// queue's client boundary.
export function ReviewQueueSurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PageFrame
      eyebrow="Admin"
      heading="Creator reviews"
      intro="Applications to become a creator. Admission is separate from project publication, deployment, launch, mint, and game permissions."
      navigation={navigation}
    >
      <ReviewQueue />
    </PageFrame>
  );
}
