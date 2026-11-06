import { describe, expect, it } from "vitest";
import type { ActiveSession } from "@frostbite/auth";
import type { UuidV7 } from "@frostbite/shared/identifiers";

import type { PageAccessDecision } from "../src/server/auth/page-access";
import { pageOutcome } from "../src/server/auth/page-outcome";

const allowed = {
  actorUserId: "018f0000-0000-7000-8000-000000000001" as UuidV7,
  kind: "allowed",
  session: {} as ActiveSession,
} satisfies PageAccessDecision;

describe("what a protected page does with the access decision", () => {
  it("shows the page to someone who may see it", () => {
    expect(pageOutcome(allowed, "/admin")).toEqual({ kind: "render" });
  });

  it("sends a visitor who is not signed in to sign in, and brings them back to the page they asked for", () => {
    expect(pageOutcome({ kind: "unauthenticated" }, "/admin/games")).toEqual({
      kind: "redirect",
      to: `/sign-in?returnTo=${encodeURIComponent("/admin/games")}`,
    });
  });

  it("does not send someone who is signed in without permission, or when the check failed, to sign in again", () => {
    expect(pageOutcome({ kind: "forbidden" }, "/admin")).toEqual({
      kind: "state",
      state: "forbidden",
    });
    expect(pageOutcome({ kind: "unavailable" }, "/admin")).toEqual({
      kind: "state",
      state: "unavailable",
    });
  });

  it("does not send a visitor back to a page it would refuse to return to, which would loop", () => {
    expect(pageOutcome({ kind: "unauthenticated" }, "/sign-in")).toEqual({
      kind: "redirect",
      to: "/sign-in",
    });
  });
});
