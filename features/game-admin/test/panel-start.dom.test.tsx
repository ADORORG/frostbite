import {
  button,
  click,
  fieldByLabel,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { byName } from "./support/find.ts";

import { apiError, defining, fakeApi } from "./support/fake-api.ts";
import { enterWallet, panel } from "./support/panel.tsx";

describe("starting a step", () => {
  it("cannot start until a wallet address is entered, and says so", async () => {
    const api = fakeApi();
    const container = await panel(api);
    expect(textOf(container)).toContain(
      "Enter your wallet address to start a step.",
    );
    expect(button(container, "Pause claims")?.disabled).toBe(true);
    await click(button(container, "Pause claims"));
    expect(api.start).not.toHaveBeenCalled();
    await enterWallet(container);
    expect(button(container, "Pause claims")?.disabled).toBe(false);
  });

  it("asks for a pause or a resume with the wallet and the auth-token output only when one was given", async () => {
    const api = fakeApi();
    const container = await panel(api);
    await enterWallet(container, " sim:one:a1b2c3fe ");
    await click(button(container, "Pause claims"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: { operation: "set-claims-paused", paused: true },
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
    await typeInto(fieldByLabel(container, "Auth token output"), "aa:0");
    await click(button(container, "Resume claims"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: { operation: "set-claims-paused", paused: false },
      authTokenOutput: "aa:0",
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
  });

  it("defines a milestone with the drawing that was typed, or without one", async () => {
    const api = fakeApi({
      start: vi.fn(async () => ({
        resumed: false,
        status: "started" as const,
        step: defining(),
      })),
    });
    const container = await panel(api);
    await enterWallet(container);
    await click(byName(container, "Define First win"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: {
        drawing: undefined,
        milestoneId: "first-win",
        operation: "define-milestone",
      },
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
    await typeInto(fieldByLabel(container, "Drawing for Streak"), "<svg/>");
    await click(byName(container, "Define Streak"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: {
        drawing: "<svg/>",
        milestoneId: "streak",
        operation: "define-milestone",
      },
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
  });

  it.each([
    [{ reason: "already-defined" as const }, "already defined"],
    [
      { detail: "too big", reason: "bad-drawing" as const },
      "The drawing was refused. too big",
    ],
    [
      { reason: "wrong-network" as const },
      "not an address on this game's network",
    ],
    [{ reason: "unavailable" as const }, "not available yet"],
    [
      { reason: "not-administered" as const },
      "not one the platform can administer",
    ],
    [
      { detail: "no funds", reason: "could-not-build" as const },
      "could not be built. no funds",
    ],
  ])("says why a step was refused: %j", async (refusal, words) => {
    const container = await panel(
      fakeApi({
        start: vi.fn(async () => ({ ...refusal, status: "refused" as const })),
      }),
    );
    await enterWallet(container);
    await click(button(container, "Pause claims"));
    expect(textOf(container)).toContain(words);
  });

  it("says when staff are signed out, and when the platform could not be reached", async () => {
    const signedOut = await panel(
      fakeApi({
        start: vi.fn(async () => {
          throw apiError("unauthorized");
        }),
      }),
    );
    await enterWallet(signedOut);
    await click(button(signedOut, "Pause claims"));
    expect(textOf(signedOut)).toContain("You are signed out");
    const down = await panel(
      fakeApi({
        start: vi.fn(async () => {
          throw apiError("network");
        }),
      }),
    );
    await enterWallet(down);
    await click(button(down, "Pause claims"));
    expect(textOf(down)).toContain("could not be reached while building");
    expect(textOf(down)).toContain("Nothing was changed.");
  });

  it("names a fault in the platform, with the reference it logged it under, and says nothing was changed", async () => {
    const reference = "018f22f2-9c1a-7b21-8c45-0000000000aa";
    const container = await panel(
      fakeApi({
        start: vi.fn(async () => {
          throw apiError("internal_error", reference);
        }),
      }),
    );
    await enterWallet(container);
    await click(button(container, "Pause claims"));
    const alert = container.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("The platform failed while building the step.");
    expect(alert).toContain(`Reference ${reference}`);
    expect(alert).toContain("Nothing was changed.");
    expect(alert).not.toContain("could not be reached");
  });

  it("says when the platform took too long, which is not the same as being unreachable", async () => {
    const container = await panel(
      fakeApi({
        start: vi.fn(async () => {
          throw new DOMException("timed out", "TimeoutError");
        }),
      }),
    );
    await enterWallet(container);
    await click(button(container, "Pause claims"));
    expect(textOf(container)).toContain("took too long to answer");
    expect(textOf(container)).not.toContain("could not be reached");
  });
});
