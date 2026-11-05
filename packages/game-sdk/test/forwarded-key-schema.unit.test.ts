import { describe, expect, it } from "vitest";

import { eventNames, events } from "../src/protocol.ts";

describe("a key the page forwards to the game", () => {
  const forwarded = events["key.forwarded"];

  it.each(["Enter", "NumpadEnter", "Space", "ArrowLeft", "KeyW", "Digit3"])(
    "carries %s, going down or up",
    (code) => {
      for (const phase of ["down", "up"] as const)
        expect(
          forwarded.safeParse({ code, phase, repeat: false }).success,
        ).toBe(true);
    },
  );

  it.each([
    ["a key the page keeps for itself", { code: "Tab" }],
    ["Escape, which leaves theatre", { code: "Escape" }],
    ["a function key", { code: "F5" }],
    ["a modifier", { code: "ShiftLeft" }],
    ["a name that only starts like a key", { code: "KeyWASD" }],
    ["no code", { code: undefined }],
    ["a phase that is not one", { code: "Enter", phase: "hold" }],
    ["an extra field", { code: "Enter", extra: true }],
    ["text in place of a flag", { code: "Enter", repeat: "no" }],
  ])("refuses %s", (_what, change) => {
    const data = Object.assign(
      { code: "Enter", phase: "down", repeat: false },
      change,
    );
    expect(forwarded.safeParse(data).success).toBe(false);
  });
});

it("is one of the events the protocol announces", () => {
  expect(eventNames).toContain("key.forwarded");
});
