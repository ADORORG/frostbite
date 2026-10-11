import { creatorApplications } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import { allIds, allPages, names } from "./support/queue-pages.ts";
import {
  database,
  draft,
  sentApplication,
  service,
  useCreatorDatabase,
  user,
} from "./support/world.ts";

useCreatorDatabase();

describe("the creator review queue's edges", () => {
  it("treats names that differ only in case as equal, so their order does not depend on the database collation", async () => {
    // With case ignored such a pair ties and falls back to the id, so the older id comes first. Compared as
    // written, the order is the database's collation: upper case first (byte order) or lower case first
    // (language order). Half the pairs are created upper-case first and half lower-case first, a
    // millisecond apart, so each reading puts some pair the wrong way round.
    for (const [index, letter] of ["m", "n", "o", "p", "q", "r"].entries()) {
      const names = [`${letter}am`, `${letter.toUpperCase()}am`];
      if (index % 2 === 1) names.reverse();
      for (const [turn, name] of names.entries()) {
        await sentApplication(
          name,
          "2026-10-01T10:00:00.000Z",
          `${String(turn)}${letter}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    const ids = await allIds("all", "name");
    expect(ids).toHaveLength(12);
    // Each pair sits together, in letter order, whatever the collation.
    expect(
      (await allPages("all", "name")).flat().map((name) => name.toLowerCase()),
    ).toEqual([
      "mam",
      "mam",
      "nam",
      "nam",
      "oam",
      "oam",
      "pam",
      "pam",
      "qam",
      "qam",
      "ram",
      "ram",
    ]);
    for (let pair = 0; pair < ids.length; pair += 2) {
      const [first, second] = [ids[pair], ids[pair + 1]];
      expect(
        first !== undefined && second !== undefined && first < second,
      ).toBe(true);
    }
  });

  it("counts and lists only applications that were sent, even one that is approved without a sent version", async () => {
    // A creator approved some other way (a seed, an import) has no submission: nothing for staff to read.
    const approved = await user();
    await database.insert(creatorApplications).values({
      applicantUserId: approved,
      draft: draft,
      id: createUuidV7(),
      state: "approved",
    });
    await sentApplication("Sent", "2026-10-01T10:00:00.000Z", "x");
    const page = await service.reviewQueue({
      group: "all",
      position: null,
      sort: "oldest",
    });
    expect(names(page)).toEqual(["Sent"]);
    expect(page.counts).toEqual({
      active: 0,
      all: 1,
      finished: 0,
      "needs-review": 1,
    });
  });
});
