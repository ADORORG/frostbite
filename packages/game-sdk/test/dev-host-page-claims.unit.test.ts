// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { gameChannel, protocolVersion } from "../src/protocol.ts";
import {
  click,
  log,
  mount,
  state,
  panel,
  useDevPage,
} from "./dev-host-page-harness.ts";

useDevPage();

describe("a claim", () => {
  async function ready() {
    const m = mount();
    await m.ask("ready", { sdkVersion: 1 });
    await m.ask("milestones.unlock", { id: "first-win" });
    return m;
  }

  it("is refused while signed out and without a wallet, saying which", async () => {
    const { ask } = await ready();
    expect(await ask("milestones.claim", { id: "first-win" })).toMatchObject({
      result: { reason: "signed-out" },
    });
    await click("dev-signin");
    expect(await ask("milestones.claim", { id: "first-win" })).toMatchObject({
      result: { reason: "no-wallet" },
    });
  });

  it("goes from waiting for the wallet to complete as the builder presses, and the game hears each step", async () => {
    const { ask, pushed } = await ready();
    await click("dev-signin");
    await click("dev-wallet");
    expect(await ask("milestones.claim", { id: "first-win" })).toMatchObject({
      result: { status: "requested" },
    });
    expect(document.getElementById("dev-claim-first-win")?.textContent).toBe(
      "Sign",
    );
    const steps: string[] = [];
    for (let press = 0; press < 3; press += 1) {
      await click("dev-claim-first-win");
      steps.push(
        (
          pushed()
            .filter((m) => m.event === "claim.changed")
            .at(-1)?.data as { state: string }
        ).state,
      );
    }
    expect(steps).toEqual(["pending", "claimed", "complete"]);
    expect(document.getElementById("dev-claim-first-win")).toBeNull();
    expect(panel()).toContain("first-win: complete");
  });
});

describe("the toast, the reset and stopping", () => {
  it("shows the message a game asks the platform to show, under the game's name", async () => {
    const { ask } = mount();
    await ask("ready", { sdkVersion: 1 });
    await ask("ui.toast", { message: "Level up!" });
    expect(document.getElementById("dev-toast")?.textContent).toBe(
      "tiny-game: Level up!",
    );
    expect(log()[0]).toContain("toast");
  });

  it("clears what this game saved and nothing else, and starts the game again", async () => {
    const { ask } = mount();
    await ask("ready", { sdkVersion: 1 });
    await ask("progress.save", { state: { level: 3 } });
    window.localStorage.setItem("another-site", "kept");
    window.localStorage.setItem("ador:game:other-game:progress", "kept");
    expect(
      Object.keys(window.localStorage).some((key) =>
        key.startsWith("ador:game:tiny-game:"),
      ),
    ).toBe(true);
    await click("dev-reset");
    expect(
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith("ador:game:tiny-game:"),
      ),
    ).toEqual([]);
    expect(window.localStorage.getItem("another-site")).toBe("kept");
    expect(window.localStorage.getItem("ador:game:other-game:progress")).toBe(
      "kept",
    );
    expect(state.recordedSrc).toHaveLength(2);
  });

  it("stops answering the game once it is taken down", async () => {
    const { ask, toGame } = mount();
    await ask("ready", { sdkVersion: 1 });
    state.page?.dispose();
    const before = toGame.mock.calls.length;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          channel: gameChannel,
          id: "late",
          method: "player.info",
          params: {},
          version: protocolVersion,
        },
        source: state.page?.frame.contentWindow ?? null,
      }),
    );
    await new Promise((wake) => setTimeout(wake, 20));
    expect(toGame.mock.calls.length).toBe(before);
  });
});
