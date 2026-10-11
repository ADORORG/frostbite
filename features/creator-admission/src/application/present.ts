import type { createCreatorAdmissionService } from "@ador/creator-admission";
import type { CreatorApplicationResponse } from "@ador/shared/creator-admission";

type Service = ReturnType<typeof createCreatorAdmissionService>;
type ApplicationView = NonNullable<Awaited<ReturnType<Service["findMine"]>>>;

// The wire form of an application: dates travel as text. The API and the server-rendered page both show an
// application in this form, so it is made in one place.
export function presentApplication(
  application: ApplicationView,
): CreatorApplicationResponse["application"] {
  const { feedback } = application;
  return {
    ...application,
    feedback:
      feedback === null
        ? null
        : { createdAt: feedback.createdAt.toISOString(), text: feedback.text },
  };
}
