import type { Resource } from "@ador/client-react";
import { describe, expect, it } from "vitest";

import { freshnessOf, holdReading } from "../src/domain/freshness.ts";

const polling = { forgetAfterMs: 600_000, refreshMs: 30_000 };
const readAt = "2026-10-27T12:00:00.000Z";
const at = (afterMs: number) => Date.parse(readAt) + afterMs;
type Answer = { readonly readAt: string | null };
const ready = (data: Answer): Resource<Answer, unknown> => ({
  data,
  status: "ready",
});
const failed = (data: Answer | null): Resource<Answer, unknown> => ({
  data,
  failure: "unreachable",
  status: "error",
});
const hold = (state: Resource<Answer, unknown>, afterMs: number) =>
  holdReading(state, (answer) => answer.readAt, at(afterMs), polling);

describe("how old a reading is", () => {
  it("is gone from the limit it is given, not from a number of refreshes", () => {
    const longer = { forgetAfterMs: 1_800_000, refreshMs: 30_000 };
    const shorter = { forgetAfterMs: 120_000, refreshMs: 30_000 };
    expect(freshnessOf(readAt, at(600_000), longer)).toBe("old");
    expect(freshnessOf(readAt, at(1_799_999), longer)).toBe("old");
    expect(freshnessOf(readAt, at(1_800_000), longer)).toBe("gone");
    expect(freshnessOf(readAt, at(119_999), shorter)).toBe("old");
    expect(freshnessOf(readAt, at(120_000), shorter)).toBe("gone");
  });

  it("is current under two refreshes, old from two, and gone at the limit", () => {
    expect(freshnessOf(readAt, at(0), polling)).toBe("current");
    expect(freshnessOf(readAt, at(59_999), polling)).toBe("current");
    expect(freshnessOf(readAt, at(60_000), polling)).toBe("old");
    expect(freshnessOf(readAt, at(599_999), polling)).toBe("old");
    expect(freshnessOf(readAt, at(600_000), polling)).toBe("gone");
  });
});

describe("what a page holds when asking again fails", () => {
  it("is loading until the first answer, and unreachable if there never was one", () => {
    expect(hold({ status: "loading" }, 0)).toEqual({ status: "loading" });
    expect(hold(failed(null), 0)).toEqual({ status: "unreachable" });
  });

  it("holds a good answer as it is", () => {
    const answer = { readAt };
    expect(hold(ready(answer), 0)).toEqual({
      data: answer,
      stale: false,
      status: "held",
    });
  });

  it("marks an answer stale by its own age, also when the ask worked: the platform may be serving its last good reading", () => {
    const answer = { readAt };
    expect(hold(ready(answer), 120_000)).toEqual({
      data: answer,
      stale: true,
      status: "held",
    });
  });

  it("keeps the last good answer when the next ask fails, marking it stale only once it is old", () => {
    const answer = { readAt };
    expect(hold(failed(answer), 10_000)).toEqual({
      data: answer,
      stale: false,
      status: "held",
    });
    expect(hold(failed(answer), 120_000)).toEqual({
      data: answer,
      stale: true,
      status: "held",
    });
  });

  it("stops showing an answer that is too old, whether or not the last ask worked", () => {
    const answer = { readAt };
    expect(hold(failed(answer), 600_000)).toEqual({ status: "unreachable" });
    expect(hold(ready(answer), 600_000)).toEqual({ status: "unreachable" });
  });

  it("never ages an answer that says no time", () => {
    const answer = { readAt: null };
    expect(hold(failed(answer), 10_000_000)).toEqual({
      data: answer,
      stale: false,
      status: "held",
    });
  });
});
