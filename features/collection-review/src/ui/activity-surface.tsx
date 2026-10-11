import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { AdminFrame } from "./admin-frame.tsx";
import { ReviewActivity } from "./review-activity.tsx";

// The staff page for the activity log. A server component: the log itself loads in the browser with
// the reviewer's own session.
export function ActivitySurface({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AdminFrame
      heading="Review activity"
      intro="Every submission and decision, newest first. Events cannot be changed or removed."
      navigation={navigation}
    >
      <ReviewActivity />
    </AdminFrame>
  );
}
