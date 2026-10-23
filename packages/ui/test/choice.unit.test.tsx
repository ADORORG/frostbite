// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

import { SegmentedChoice } from "../src/components/segmented-choice.tsx";
import { press, show } from "./support/render.tsx";

afterEach(() => {
  document.body.replaceChildren();
});

const options = [
  { detail: "about 4 h", label: "Slow", meta: "1.01 sat/vB", value: "slow" },
  { detail: "about 1 h", label: "Medium", meta: "3 sat/vB", value: "medium" },
  {
    disabled: true,
    hint: "Over limit",
    label: "Fast",
    meta: "9 sat/vB",
    value: "fast",
  },
] as const;
const radios = (box: HTMLElement) => [
  ...box.querySelectorAll<HTMLInputElement>("input[type=radio]"),
];

it("shows every choice with its figures, and the chosen one checked", async () => {
  const box = await show(
    <SegmentedChoice
      legend="How fast"
      onChange={() => undefined}
      options={options}
      value="medium"
    />,
  );
  expect(box.querySelector("legend")?.textContent).toBe("How fast");
  expect(radios(box).map((radio) => [radio.value, radio.checked])).toEqual([
    ["slow", false],
    ["medium", true],
    ["fast", false],
  ]);
  expect(box.textContent).toContain("1.01 sat/vB");
  expect(box.textContent).toContain("about 1 h");
  expect(box.textContent).toContain("Over limit");
  // The three radios belong to one group.
  expect(new Set(radios(box).map((radio) => radio.name)).size).toBe(1);
});

it("reports the choice made, and nothing for a choice that is off, by any route", async () => {
  const onChange = vi.fn<(value: string) => void>();
  const box = await show(
    <SegmentedChoice
      legend="How fast"
      onChange={onChange}
      options={options}
      value="slow"
    />,
  );
  await press(radios(box)[1] ?? null);
  expect(onChange).toHaveBeenCalledWith("medium");
  onChange.mockClear();
  expect(radios(box)[2]?.disabled).toBe(true);
  await press(radios(box)[2] ?? null);
  expect(onChange).not.toHaveBeenCalled();
  expect(
    box.querySelectorAll('.segmented__option[data-off="true"]'),
  ).toHaveLength(1);
});

it("is switched off as a whole when asked", async () => {
  const box = await show(
    <SegmentedChoice
      disabled
      legend="How fast"
      onChange={() => undefined}
      options={options}
      value="slow"
    />,
  );
  expect(box.querySelector("fieldset")?.disabled).toBe(true);
});
