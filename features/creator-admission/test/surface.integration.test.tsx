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
      <CreatorApplicationSurface application={null} unavailable={false} />,
    );
    expect(markup).toContain("Apply to create");
    expect(markup).toContain("Save private draft");
    expect(markup).toContain("separate from project publication");
  });

  it("keeps the reviewer's decision and private notes off the applicant's page", () => {
    const studio = renderToStaticMarkup(
      <CreatorApplicationSurface application={null} unavailable={false} />,
    );
    expect(studio).not.toContain("Private reviewer notes");
    expect(studio).not.toContain("Record decision");
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
      feedback: null,
      id: createUuidV7(),
      revision: 1,
      state: "draft" as const,
    };
    expect(
      renderToStaticMarkup(
        <CreatorApplicationSurface
          application={application}
          unavailable={false}
        />,
      ),
    ).toContain("Visible Creator");
    const degraded = renderToStaticMarkup(
      <CreatorApplicationSurface application={null} unavailable />,
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
  feedback: null,
  id: createUuidV7(),
  revision: 2,
  state,
});

describe("creator application status", () => {
  const studio = (application: ReturnType<typeof sent> | null) =>
    renderToStaticMarkup(
      <CreatorApplicationSurface
        application={application}
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
  it("leads an applicant back to the studio", () => {
    const markup = renderToStaticMarkup(
      <CreatorApplicationSurface application={null} unavailable={false} />,
    );
    expect(markup).toMatch(/href="\/studio"[^>]*>Back to studio/);
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
        unavailable={false}
      />,
    );
    expect(markup).toContain(`arcade-badge arcade-badge--${tone}`);
  });
});

describe("what a reviewer wrote for the applicant", () => {
  const withFeedback = (state: CreatorApplicationState, text: string) => ({
    ...sent(state),
    feedback: { createdAt: "2026-10-10T12:30:00.000Z", text },
  });
  const show = (
    application: Parameters<typeof CreatorApplicationSurface>[0]["application"],
  ) =>
    renderToStaticMarkup(
      <CreatorApplicationSurface
        application={application}
        unavailable={false}
      />,
    );

  it.each(["changes-requested", "rejected", "suspended", "revoked"] as const)(
    "is shown, with its date, while the application is %s",
    (state) => {
      const markup = show(withFeedback(state, "Add a portfolio link."));
      expect(markup).toContain('aria-label="Message from a reviewer"');
      expect(markup).toContain("From a reviewer, 2026-10-10");
      expect(markup).toContain("Add a portfolio link.");
    },
  );

  it.each(["draft", "submitted", "under-review", "approved"] as const)(
    "is an old message, and not shown, while the application is %s",
    (state) => {
      expect(show(withFeedback(state, "Add a portfolio link."))).not.toContain(
        "Message from a reviewer",
      );
    },
  );

  it("is not invented when a reviewer has written nothing", () => {
    expect(show(sent("changes-requested"))).not.toContain(
      "Message from a reviewer",
    );
  });

  it("is shown as text, so nothing a reviewer types can act as markup", () => {
    const markup = show(
      withFeedback("changes-requested", "<img src=x onerror=alert(1)>"),
    );
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<img");
  });

  it("sits between the status and the form the applicant can still use", () => {
    const markup = show(withFeedback("changes-requested", "Add a link."));
    expect(markup.indexOf("Application status")).toBeLessThan(
      markup.indexOf("Message from a reviewer"),
    );
    expect(markup.indexOf("Message from a reviewer")).toBeLessThan(
      markup.indexOf("Save private draft"),
    );
  });
});
