// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { forwardedKeyOf } from "../src/ui/key-forwarding.ts";

// The page forwards a key to the game only when the keyboard is the page's and not a control's: nothing is focused, so the key would
// do nothing at all, and the player has not clicked into the game's frame, where the key would already reach the game.
const press = (
  code: string,
  options: {
    readonly altKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly defaultPrevented?: boolean;
    readonly metaKey?: boolean;
    readonly repeat?: boolean;
    readonly type?: string;
  } = {},
) => ({
  altKey: false,
  code,
  ctrlKey: false,
  defaultPrevented: false,
  metaKey: false,
  repeat: false,
  type: "keydown",
  ...options,
});

describe("the keys the page forwards to the game", () => {
  it("forwards a key pressed with nothing focused, going down and coming up", () => {
    expect(forwardedKeyOf(press("Enter"), document.body)).toEqual({
      code: "Enter",
      phase: "down",
      repeat: false,
    });
    expect(
      forwardedKeyOf(press("KeyW", { type: "keyup" }), document.body),
    ).toEqual({ code: "KeyW", phase: "up", repeat: false });
  });

  it("treats the page itself, or no element, as nothing focused", () => {
    expect(forwardedKeyOf(press("Space"), null)?.code).toBe("Space");
    expect(forwardedKeyOf(press("Space"), document.documentElement)?.code).toBe(
      "Space",
    );
  });

  it("passes on that a key is a repeat", () => {
    expect(
      forwardedKeyOf(press("ArrowUp", { repeat: true }), document.body)?.repeat,
    ).toBe(true);
  });

  it("keeps the keyboard when a control has it: a button, a link, a field, the frame", () => {
    for (const tag of [
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "iframe",
    ]) {
      const control = document.createElement(tag);
      document.body.append(control);
      expect(forwardedKeyOf(press("Enter"), control)).toBeNull();
      control.remove();
    }
  });

  it.each([
    ["Tab, which walks the page", "Tab"],
    ["Escape, which leaves theatre", "Escape"],
    ["a function key", "F11"],
    ["a modifier", "ShiftLeft"],
  ])("never forwards %s", (_what, code) => {
    expect(forwardedKeyOf(press(code), document.body)).toBeNull();
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves a shortcut with %s to the browser", (_name, options) => {
    expect(forwardedKeyOf(press("KeyR", options), document.body)).toBeNull();
  });

  it("leaves a key something else on the page already used", () => {
    expect(
      forwardedKeyOf(press("Enter", { defaultPrevented: true }), document.body),
    ).toBeNull();
  });
});
