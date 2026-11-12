// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachTouch, zoneAt } from "../src/screen/touch.ts";

describe("the screen as the controller on a phone", () => {
  it("is cut into thirds across: left slides left, right slides right, and the middle turns", () => {
    expect(zoneAt({ x: 0, y: 0.5 })).toBe("left");
    expect(zoneAt({ x: 0.32, y: 0.9 })).toBe("left");
    expect(zoneAt({ x: 0.34, y: 0.1 })).toBe("turn");
    expect(zoneAt({ x: 0.5, y: 0.5 })).toBe("turn");
    expect(zoneAt({ x: 0.66, y: 0.5 })).toBe("turn");
    expect(zoneAt({ x: 0.67, y: 0.5 })).toBe("right");
    expect(zoneAt({ x: 1, y: 1 })).toBe("right");
  });

  describe("with its buttons", () => {
    const stops: (() => void)[] = [];
    afterEach(() => {
      for (const stop of stops.splice(0)) stop();
      document.body.replaceChildren();
    });
    const setup = () => {
      const main = document.createElement("main");
      const screen = document.createElement("canvas");
      main.append(screen);
      document.body.append(main);
      const controls = {
        hard: vi.fn(),
        hold: vi.fn(),
        left: vi.fn(),
        pause: vi.fn(),
        right: vi.fn(),
        soft: vi.fn(),
        start: vi.fn(),
        turnLeft: vi.fn(),
        turnRight: vi.fn(),
      };
      stops.push(attachTouch(screen, main, controls));
      const button = (label: string) =>
        [...main.querySelectorAll("button")].find(
          (found) => found.textContent === label,
        );
      return { button, controls, main };
    };

    it("has four buttons, drop, soft drop, hold and turn back, and no more", () => {
      const { main } = setup();
      expect(
        [...main.querySelectorAll(".touch-buttons button")].map(
          (found) => found.textContent,
        ),
      ).toEqual(["Drop", "Soft", "Hold", "Turn"]);
    });

    it("does what each says when it is pressed, and lets go of the soft drop when it is let go", () => {
      const { button, controls } = setup();
      button("Drop")?.click();
      button("Hold")?.click();
      button("Turn")?.click();
      button("Soft")?.click();
      expect(controls.hard).toHaveBeenCalledTimes(1);
      expect(controls.hold).toHaveBeenCalledTimes(1);
      expect(controls.turnLeft).toHaveBeenCalledTimes(1);
      expect(controls.soft.mock.calls).toEqual([[true], [false]]);
      expect(controls.turnRight).not.toHaveBeenCalled();
    });

    it("takes the buttons away when it is told to stop", () => {
      const { main } = setup();
      for (const stop of stops.splice(0)) stop();
      expect(main.querySelectorAll(".touch-buttons button")).toHaveLength(0);
    });
  });
});
