import { profileAvatarIds } from "@frostbite/shared/profiles";
import { avatarSpriteIds } from "@repo/ui/arcade";
import { describe, expect, it } from "vitest";

import { profileCopy } from "../src/domain/copy.ts";

describe("the words of the profile pages", () => {
  it("say each reason a name is refused, with the server's bounds in them", () => {
    const bounds = { maxLength: 12, minLength: 4 };
    expect(profileCopy.nameReason("too-short", bounds)).toContain("4");
    expect(profileCopy.nameReason("too-long", bounds)).toContain("12");
    expect(profileCopy.nameReason("bad-characters", bounds)).toContain(
      "Letters",
    );
    expect(profileCopy.nameReason("blocked", bounds)).toContain(
      "isn't available",
    );
  });

  it("count one and many correctly", () => {
    expect(profileCopy.card.stats.bests(1)).toBe("verified best");
    expect(profileCopy.card.stats.bests(0)).toBe("verified bests");
    expect(profileCopy.card.stats.mints(1)).toBe("milestone minted");
    expect(profileCopy.card.stats.mints(2)).toBe("milestones minted");
  });

  it("show the name's length against its bound", () => {
    expect(profileCopy.setup.name.count(5, 20)).toBe("5/20");
    expect(profileCopy.setup.name.hint(3, 20)).toBe(
      "3–20 letters, numbers, _ or -",
    );
  });
});

describe("the preset avatars", () => {
  it("are drawn for every id a profile may hold, and for no other", () => {
    expect([...avatarSpriteIds].sort()).toEqual([...profileAvatarIds].sort());
  });
});
