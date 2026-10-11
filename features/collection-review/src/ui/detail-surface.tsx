import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { AdminFrame } from "./admin-frame.tsx";
import { ReviewDetail } from "./review-detail.tsx";

// The staff page for one submission. The submission is loaded in the browser with the reviewer's own
// session, so nothing about it is rendered on the server.
export function DetailSurface({
  navigation,
  submissionId,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly submissionId: string;
}) {
  return (
    <AdminFrame
      heading="Review a submission"
      intro="This is the version the creator froze. Editing the draft later does not change it."
      navigation={navigation}
    >
      <ReviewDetail submissionId={submissionId} />
    </AdminFrame>
  );
}
