// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { ArcadeToggleTabs } from "../src/components/arcade-toggle-tabs.tsx";

const options = [
  { count: 3, label: "Arcade", value: "arcade" },
  { count: 0, label: "Rhythm", value: "rhythm" },
  { count: 2, label: "Puzzle", value: "puzzle" },
] as const;

it("shows every switch with its count and marks each one that is on, any number of them", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ArcadeToggleTabs
      label="Kinds"
      onChange={() => undefined}
      options={options}
      selected={["arcade", "puzzle"]}
    />,
  );
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.map((each) => each.textContent)).toEqual([
    "Arcade3",
    "Rhythm0",
    "Puzzle2",
  ]);
  expect(buttons.map((each) => each.getAttribute("aria-pressed"))).toEqual([
    "true",
    "false",
    "true",
  ]);
  expect(
    container.querySelector('[role="group"]')?.getAttribute("aria-label"),
  ).toBe("Kinds");
});

it("reports the switch pressed and whether it is now on or off", async () => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  await act(() =>
    root.render(
      <ArcadeToggleTabs
        label="Kinds"
        onChange={onChange}
        options={options}
        selected={["puzzle"]}
      />,
    ),
  );
  const [arcade, , puzzle] = container.querySelectorAll("button");
  await act(() => {
    arcade?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith("arcade", true);
  await act(() => {
    puzzle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith("puzzle", false);
  await act(() => root.unmount());
  container.remove();
});
