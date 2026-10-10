import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createPlatformShellEntrypoint } from "../src/entrypoint.js";
import { PlatformHome } from "../src/ui/home.js";

describe("PlatformHome", () => {
  it("renders truthful status and the injected feature count", async () => {
    const markup = renderToStaticMarkup(
      <PlatformHome
        navigation={[
          { area: "footer", href: "/launches", label: "Launches" },
          { area: "main", href: "/games", label: "Games" },
        ]}
        registeredFeatureIds={["platform-shell", "launches", "games"]}
        registeredFeatures={3}
      />,
    );
    expect(markup).toContain("3 REGISTERED");
    expect(markup).toContain("No live sale is configured");
    expect(markup).not.toContain("Connect wallet");

    const [page] =
      createPlatformShellEntrypoint({
        registeredFeatureCount: 3,
        registeredFeatureIds: ["platform-shell", "launches", "games"],
      }).pages ?? [];
    expect(page?.path).toBe("/");
    expect(
      renderToStaticMarkup(
        await page?.render({ actorUserId: null, navigation: [], params: {} }),
      ),
    ).toContain("3 REGISTERED");
  });

  it.each([
    {
      absentHref: "/games",
      absentId: "games",
      absentLabel: "01 PLANNED",
      present: "launches",
    },
    {
      absentHref: "/launches",
      absentId: "launches",
      absentLabel: "GATED",
      present: "games",
    },
  ] as const)(
    "removes every surface owned by detached $absentId",
    (testCase) => {
      const markup = renderToStaticMarkup(
        <PlatformHome
          navigation={[
            {
              area: "main",
              href: `/${testCase.present}`,
              label: testCase.present,
            },
          ]}
          registeredFeatureIds={["platform-shell", testCase.present]}
          registeredFeatures={2}
        />,
      );

      expect(markup).toContain(`href="/${testCase.present}"`);
      expect(markup).not.toContain(`href="${testCase.absentHref}"`);
      expect(markup).not.toContain(`id="${testCase.absentId}"`);
      expect(markup).not.toContain(testCase.absentLabel);
    },
  );
});
