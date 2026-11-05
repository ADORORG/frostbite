// @vitest-environment jsdom

import { mount } from "@frostbite/test-kit/dom";
import { standInInitials } from "@repo/ui/arcade";
import { describe, expect, it } from "vitest";

import { Medallion } from "../src/ui/medallion.tsx";

describe("the medallion for a mint with no picture", () => {
  it("is the initials and a check on its own colours when the game has no cover, and hides itself from a screen reader", async () => {
    const container = await mount(
      <Medallion cover={null} name="First level" />,
    );
    const medallion = container.querySelector(".medallion");
    expect(medallion?.getAttribute("aria-hidden")).toBe("true");
    expect(medallion?.querySelector(".medallion__cover")).toBeNull();
    expect(medallion?.querySelector(".medallion__badge")?.textContent).toBe(
      standInInitials("First level"),
    );
    expect(medallion?.querySelector(".medallion__check")).not.toBeNull();
  });

  it("has the same colours for the same name, so a milestone always looks alike", async () => {
    const tone = async (name: string) =>
      (await mount(<Medallion cover={null} name={name} />))
        .querySelector(".medallion")
        ?.className.match(/stand-in--(\d)/u)?.[1];
    expect(await tone("Century")).toBe(await tone("Century"));
  });
});
