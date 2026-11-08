import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sharedPagePath } from "@frostbite/shared/games";
import { createGamesEntrypoint } from "../src/entrypoint.tsx";
import { shareCopy } from "../src/domain/share-copy.ts";
import {
  chains,
  claimsConfig,
  runsConfig,
  templateGame,
  walletConfig,
} from "./support/template-game.ts";

const page = createGamesEntrypoint(
  [templateGame],
  chains,
  walletConfig,
  runsConfig,
  claimsConfig,
).pages?.find((candidate) => candidate.path === sharedPagePath);

// An identifier that is not one is refused before any database is asked, so these need none.
describe("the shared page's route", () => {
  it("is public, so a pasted link can be opened by anyone", () => {
    expect(page?.access).toEqual({ kind: "public" });
  });

  const notLinks: Record<string, string>[] = [
    { id: "not-an-id" },
    { id: "" },
    {},
  ];
  it.each(notLinks)(
    "shows nothing and keeps out of previews for %j",
    async (params) => {
      expect(await page?.metadata?.({ params })).toEqual({ kind: "private" });
      const markup = renderToStaticMarkup(
        await page?.render({
          actorUserId: null,
          navigation: [],
          params,
        }),
      );
      expect(markup).toContain(shareCopy.notFoundTitle);
    },
  );
});
