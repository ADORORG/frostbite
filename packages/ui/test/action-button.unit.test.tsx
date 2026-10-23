// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { ArcadeActionButton } from "../src/primitives/arcade-action-button.tsx";
import { press, show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

it("is a plain button until something is under way, and can be named apart from its words and made small", async () => {
  let pressed = 0;
  const box = await show(
    <ArcadeActionButton
      ariaLabel="Publish game-rewards"
      onClick={() => (pressed += 1)}
      size="small"
    >
      Publish
    </ArcadeActionButton>,
  );
  const button = box.querySelector("button");
  expect(button?.getAttribute("aria-label")).toBe("Publish game-rewards");
  expect(button?.dataset["size"]).toBe("small");
  expect(button?.hasAttribute("aria-busy")).toBe(false);
  expect(button?.disabled).toBe(false);
  expect(box.querySelector(".spinner")).toBeNull();
  await press(button ?? null);
  expect(pressed).toBe(1);
});

it("shows an action under way with the ring, and cannot be pressed again while it is", async () => {
  let pressed = 0;
  const box = await show(
    <ArcadeActionButton busy onClick={() => (pressed += 1)}>
      Preparing…
    </ArcadeActionButton>,
  );
  const button = box.querySelector("button");
  expect(button?.getAttribute("aria-busy")).toBe("true");
  expect(button?.disabled).toBe(true);
  expect(box.querySelector(".spinner")).not.toBeNull();
  expect(button?.textContent).toBe("Preparing…");
  await press(button ?? null);
  expect(pressed).toBe(0);
});

it("stays off when it is disabled, busy or not", async () => {
  const box = await show(<ArcadeActionButton disabled>Go</ArcadeActionButton>);
  expect(box.querySelector("button")?.disabled).toBe(true);
  expect(box.querySelector("button")?.hasAttribute("aria-busy")).toBe(false);
});
