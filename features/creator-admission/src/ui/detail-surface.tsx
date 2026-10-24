import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame } from "@repo/ui/arcade";

import { ReviewDetail } from "./review-detail.tsx";

// The staff page for one application. It is loaded in the browser with the reviewer's own session, so
// nothing about it is rendered on the server.
export function ReviewDetailSurface({
  applicationId,
  navigation,
}: {
  readonly applicationId: string;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PageFrame
      eyebrow="Admin"
      footerLabel="Creator admission beta"
      heading="Review an application"
      intro="This is the version the applicant sent. Editing their draft later does not change it."
      navigation={navigation}
    >
      <ReviewDetail applicationId={applicationId} />
    </PageFrame>
  );
}
