import { describe, expect, it } from "vitest";

import { checkSandbox } from "../src/sandbox.ts";

const allowed = () => 1;
const refused = () => {
  throw new Error("refused");
};
const rejected = () => Promise.reject(new Error("refused"));

describe("the sandbox check", () => {
  it("says what happened to each thing a game must not do", async () => {
    expect(
      await checkSandbox({
        cookie: refused,
        fetch: rejected,
        localStorage: refused,
      }),
    ).toEqual({ cookie: "blocked", fetch: "blocked", localStorage: "blocked" });
  });

  it("says so when something is allowed, and only that thing", async () => {
    expect(
      await checkSandbox({
        cookie: allowed,
        fetch: rejected,
        localStorage: refused,
      }),
    ).toEqual({ cookie: "allowed", fetch: "blocked", localStorage: "blocked" });
    expect(
      await checkSandbox({
        cookie: refused,
        fetch: allowed,
        localStorage: allowed,
      }),
    ).toEqual({ cookie: "blocked", fetch: "allowed", localStorage: "allowed" });
  });
});
