import {
  creatorStandingCopy,
  type CreatorApplicationState,
} from "@ador/shared/creator-admission";
import { createUuidV7 } from "@ador/shared/identifiers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CreatorApplicationSurface } from "../src/ui/creator-application-surface.tsx";

describe("creator admission surfaces", () => {
  it("renders a studio form without claiming project authority", () => {
    const markup = renderToStaticMarkup(
      <CreatorApplicationSurface
        application={null}
        mode="studio"
        unavailable={false}
      />,
    );
    expect(markup).toContain("Apply to create");
    expect(markup).toContain("Save private draft");
    expect(markup).toContain("separate from project publication");
  });

  it("keeps private review fields off the creator surface", () => {
    const review = renderToStaticMarkup(
      <CreatorApplicationSurface
        application={null}
        mode="review"
        unavailable={false}
      />,
    );
    const studio = renderToStaticMarkup(
      <CreatorApplicationSurface
        application={null}
        mode="studio"
        unavailable={false}
      />,
    );
    expect(review).toContain("Private reviewer notes");
    expect(studio).not.toContain("Private reviewer notes");
    // Each audience gets its own page title.
    expect(review).toContain("<h1>Review creator admission</h1>");
    expect(studio).toContain("<h1>Apply to create</h1>");
  });

  it("renders persisted values and an honest degraded state", () => {
    const application = {
      applicantUserId: createUuidV7(),
      draft: {
        contentDeclarationAccepted: true,
        displayName: "Visible Creator",
        expectedLaunchSize: "Small",
        expectedLaunchTiming: "Soon",
        jurisdictionAcknowledged: true,
        portfolioLinks: [],
        projectSummary: "Visible summary",
        provenanceDeclarationAccepted: true,
        rightsDeclarationAccepted: true,
      },
      id: createUuidV7(),
      revision: 1,
      state: "draft" as const,
    };
    expect(
      renderToStaticMarkup(
        <CreatorApplicationSurface
          application={application}
          mode="studio"
          unavailable={false}
        />,
      ),
    ).toContain("Visible Creator");
    const degraded = renderToStaticMarkup(
      <CreatorApplicationSurface
        application={null}
        mode="studio"
        unavailable
      />,
    );
    expect(degraded).toContain("No state is being inferred");
    expect(degraded).not.toContain("Save private draft");
  });
});

const sent = (state: CreatorApplicationState) => ({
  applicantUserId: createUuidV7(),
  draft: {
    contentDeclarationAccepted: true,
    displayName: "Sent Creator",
    expectedLaunchSize: "Small",
    expectedLaunchTiming: "Soon",
    jurisdictionAcknowledged: false,
    portfolioLinks: ["https://example.test/work"],
    projectSummary: "Sent summary",
    provenanceDeclarationAccepted: true,
    rightsDeclarationAccepted: true,
  },
  id: createUuidV7(),
  revision: 2,
  state,
});

describe("creator application status", () => {
  const studio = (application: ReturnType<typeof sent> | null) =>
    renderToStaticMarkup(
      <CreatorApplicationSurface
        application={application}
        mode="studio"
        unavailable={false}
      />,
    );

  it("tells a person who never applied so, and offers the form", () => {
    const markup = studio(null);
    expect(markup).toContain("Not a creator yet");
    expect(markup).toContain("Save private draft");
  });

  it.each(["draft", "changes-requested"] as const)(
    "keeps the form while the application is %s",
    (state) => {
      const markup = studio(sent(state));
      expect(markup).toContain(creatorStandingCopy[state].headline);
      expect(markup).toContain("Save private draft");
      expect(markup).not.toContain("What you sent");
    },
  );

  it.each([
    "submitted",
    "under-review",
    "approved",
    "rejected",
    "suspended",
    "revoked",
  ] as const)(
    "shows what was sent, read-only, once the application is %s",
    (state) => {
      const markup = studio(sent(state));
      expect(markup).toContain(creatorStandingCopy[state].headline);
      expect(markup).toContain("What you sent");
      expect(markup).toContain("Sent Creator");
      expect(markup).toContain("https://example.test/work");
      expect(markup).not.toContain("Save private draft");
      expect(markup).not.toContain("Submit snapshot");
      expect(markup).not.toContain("<form");
    },
  );

  it("shows declarations as they were answered, and leads an approved creator to collections", () => {
    const approved = studio(sent("approved"));
    expect(approved).toMatch(
      /Acknowledges jurisdiction requirements<\/dt><dd>No</,
    );
    expect(approved).toMatch(
      /Holds the required rights and licences<\/dt><dd>Yes</,
    );
    expect(approved).toContain("Can build collections");
    expect(approved).toContain('href="/studio/collections"');
    expect(studio(sent("submitted"))).not.toContain(
      'href="/studio/collections"',
    );
    expect(studio(sent("submitted"))).toContain("Cannot build collections yet");
  });
});

describe("creator admission page navigation", () => {
  const surface = (mode: "review" | "studio") =>
    renderToStaticMarkup(
      <CreatorApplicationSurface
        application={null}
        mode={mode}
        unavailable={false}
      />,
    );

  it("leads an applicant back to the studio, and offers a reviewer no way into it", () => {
    expect(surface("studio")).toMatch(/href="\/studio"[^>]*>Back to studio/);
    expect(surface("review")).not.toContain("Back to studio");
  });

  it.each([
    ["approved", "mint"],
    ["changes-requested", "pink"],
    ["draft", "yellow"],
    ["rejected", "red"],
    ["submitted", "cyan"],
  ] as const)("shows an application that is %s in %s", (state, tone) => {
    const markup = renderToStaticMarkup(
      <CreatorApplicationSurface
        application={sent(state)}
        mode="studio"
        unavailable={false}
      />,
    );
    expect(markup).toContain(`arcade-badge arcade-badge--${tone}`);
  });
});
