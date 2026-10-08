import { uuidV7TextSchema } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";

describe("creator E2E fixtures", () => {
  const actors = Object.values(creatorE2EFixtures);
  const roleIds = actors.flatMap((actor) =>
    "roleId" in actor ? [actor.roleId] : [],
  );

  it("uses distinct UUIDv7 identities for every seeded record", () => {
    const ids = [
      ...actors.flatMap(({ sessionId, userId }) => [sessionId, userId]),
      ...roleIds,
    ];
    expect(ids.map((id) => uuidV7TextSchema.parse(id))).toHaveLength(
      ids.length,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every seeded session credential distinct", () => {
    const tokens = actors.map(({ sessionToken }) => sessionToken);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("keeps role-bearing credentials attached to their named actor", () => {
    expect(creatorE2EFixtures.reviewer.sessionToken).toContain("reviewer");
    expect(creatorE2EFixtures.staff.sessionToken).toContain("staff");
    expect(creatorE2EFixtures.visualUser.sessionToken).toContain("visual");
    expect(creatorE2EFixtures.uploader.sessionToken).toContain("uploader");
    expect(creatorE2EFixtures.otherUploader.sessionToken).toContain(
      "other-uploader",
    );
  });
});
