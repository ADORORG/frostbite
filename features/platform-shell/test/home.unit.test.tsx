import { ScenesProvider } from "@frostbite/scenes/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { homeCopy } from "../src/domain/home-copy.ts";
import { createPlatformShellEntrypoint } from "../src/entrypoint.js";
import { PlatformHome } from "../src/ui/home.js";

const home = (props: Partial<Parameters<typeof PlatformHome>[0]> = {}) =>
  renderToStaticMarkup(
    <ScenesProvider>
      <PlatformHome
        navigation={[]}
        registeredFeatureIds={["platform-shell"]}
        {...props}
      />
    </ScenesProvider>,
  );

describe("PlatformHome", () => {
  it("says what the platform is for, over a moving background, with nothing about how it is built", async () => {
    const markup = home({
      navigation: [
        { area: "footer", href: "/launches", label: "Launches" },
        { area: "main", href: "/games", label: "Games" },
      ],
      registeredFeatureIds: ["platform-shell", "launches", "games"],
    });
    expect(markup).toContain(homeCopy.headline.first);
    expect(markup).toContain(homeCopy.headline.second);
    expect(markup).not.toMatch(/registered|gated|foundation/iu);
    expect(markup).toContain("scene-backdrop");
    expect(markup).not.toContain("Connect wallet");

    const [page] =
      createPlatformShellEntrypoint({
        registeredFeatureCount: 3,
        registeredFeatureIds: ["platform-shell", "launches", "games"],
      }).pages ?? [];
    expect(page?.path).toBe("/");
    expect(
      renderToStaticMarkup(
        <ScenesProvider>
          {await page?.render({
            actorUserId: null,
            homeSections: [],
            navigation: [],
            params: {},
          })}
        </ScenesProvider>,
      ),
    ).toContain(homeCopy.headline.first);
  });

  it("draws the sections its page is given, in the page it serves", async () => {
    const [page] =
      createPlatformShellEntrypoint({
        registeredFeatureCount: 2,
        registeredFeatureIds: ["platform-shell", "games"],
      }).pages ?? [];
    const markup = renderToStaticMarkup(
      <ScenesProvider>
        {await page?.render({
          actorUserId: null,
          homeSections: [
            {
              id: "games",
              order: 1,
              render: () => <p id="drawn-games">games</p>,
            },
            {
              id: "late",
              order: 2,
              render: async () => <p id="drawn-late">late</p>,
            },
          ],
          navigation: [],
          params: {},
        })}
      </ScenesProvider>,
    );
    expect(markup).toContain('id="drawn-games"');
    expect(markup).toContain('id="drawn-late"');
  });

  it("claims nothing about games or networks it does not know: no stale counts", () => {
    const markup = home({
      registeredFeatureIds: ["platform-shell", "games"],
    });
    expect(markup).not.toContain("PLANNED");
    expect(markup).not.toContain("UNSET");
    expect(markup).not.toContain("Gated");
  });

  it("lays out the parts the features supplied, in the order given, each in place", () => {
    const markup = home({
      sections: [
        { id: "games", node: <section id="games-rail">games</section> },
        {
          id: "collections",
          node: <section id="collections-rail">collections</section>,
        },
      ],
    });
    expect(markup.indexOf("games-rail")).toBeGreaterThan(
      markup.indexOf("Launch your legacy"),
    );
    expect(markup.indexOf("games-rail")).toBeLessThan(
      markup.indexOf("collections-rail"),
    );
  });

  it.each([
    { absentHref: "/games", present: "launches" },
    { absentHref: "/launches", present: "games" },
  ] as const)(
    "removes every link owned by a detached feature (not $present)",
    (testCase) => {
      const markup = home({
        navigation: [
          {
            area: "main",
            href: `/${testCase.present}`,
            label: testCase.present,
          },
        ],
        registeredFeatureIds: ["platform-shell", testCase.present],
      });
      expect(markup).toContain(`href="/${testCase.present}"`);
      expect(markup).not.toContain(`href="${testCase.absentHref}"`);
    },
  );
});
