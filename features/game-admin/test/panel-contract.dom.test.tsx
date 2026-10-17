import {
  button,
  click,
  fieldByLabel,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { creating, fakeApi, listing, step } from "./support/fake-api.ts";
import { enterWallet, panel } from "./support/panel.tsx";

const noContract = (templatesReady: boolean) =>
  fakeApi({
    list: vi.fn(async () => ({
      contract: null,
      steps: [],
      templatesReady,
    })),
  });

describe("a game with no contract yet", () => {
  it("waits for the record before showing anything to do, and says what it is waiting for", async () => {
    let release: () => void = () => undefined;
    const api = fakeApi({
      list: vi.fn(
        () =>
          new Promise<ReturnType<typeof listing>>((resolve) => {
            release = () => resolve(listing([]));
          }),
      ),
    });
    const container = await panel(api);
    expect(textOf(container)).toContain("Loading this game's contract");
    expect(button(container, "Pause claims")).toBeNull();
    release();
    await settle(() =>
      expect(button(container, "Pause claims")).not.toBeNull(),
    );
  });

  it("says it cannot be administered, and where to publish the templates first, until both are published", async () => {
    const container = await panel(noContract(false));
    await settle(() =>
      expect(textOf(container)).toContain("has no rewards contract yet"),
    );
    expect(textOf(container)).toContain("not both published yet");
    expect(container.querySelector("a[href='/admin/games']")).not.toBeNull();
    expect(button(container, "Create the contract")).toBeNull();
    expect(button(container, "Pause claims")).toBeNull();
    expect(container.querySelector("[data-milestone]")).toBeNull();
    expect(textOf(container)).not.toContain("Auth token output");
  });

  it("offers to create the contract once the templates are published, with the size staff choose", async () => {
    const api = noContract(true);
    const container = await panel(api);
    await settle(() =>
      expect(button(container, "Create the contract")).not.toBeNull(),
    );
    expect(button(container, "Create the contract")?.disabled).toBe(true);
    await enterWallet(container);
    expect(button(container, "Create the contract")?.disabled).toBe(false);
    await click(button(container, "Create the contract"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: { maxDrawingBytes: 4096, operation: "deploy" },
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
    await typeInto(fieldByLabel(container, "Largest drawing (bytes)"), "2048");
    await click(button(container, "Create the contract"));
    expect(api.start).toHaveBeenLastCalledWith({
      action: { maxDrawingBytes: 2048, operation: "deploy" },
      gameId: "arcade",
      wallet: "sim:one:a1b2c3fe",
    });
  });

  it("does not offer a size that is not a positive whole number", async () => {
    const container = await panel(noContract(true));
    await settle(() =>
      expect(button(container, "Create the contract")).not.toBeNull(),
    );
    await enterWallet(container);
    for (const size of ["", "0", "-5", "1.5", "lots"]) {
      await typeInto(fieldByLabel(container, "Largest drawing (bytes)"), size);
      expect(button(container, "Create the contract")?.disabled).toBe(true);
    }
  });

  it("shows the review of the step that creates it, naming what it is made from and what the network says it made", async () => {
    const api = noContract(true);
    api.start = vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: creating(),
    }));
    const container = await panel(api);
    await settle(() =>
      expect(button(container, "Create the contract")).not.toBeNull(),
    );
    await enterWallet(container);
    await click(button(container, "Create the contract"));
    const review = container.querySelector('[data-testid="step-review"]');
    expect(review?.textContent).toContain("Create the game's contract");
    expect(review?.textContent).toContain("game-rewards 1.0.0 at at-1");
    expect(review?.textContent).toContain("at-2");
    expect(review?.textContent).toContain("4096 bytes");
    expect(review?.textContent).not.toContain("Rewards contract");
    expect(
      container.querySelector('[data-testid="created-contracts"]'),
    ).toBeNull();
  });

  it("says what the network reports a step created once it did", async () => {
    const made = creating({
      createdContracts: ["2:7"],
      state: "complete",
      toSign: null,
    });
    const api = fakeApi({
      list: vi.fn(async () => ({
        contract: null,
        steps: [made],
        templatesReady: true,
      })),
    });
    const container = await panel(api);
    await settle(() => expect(textOf(container)).toContain("Details"));
    await click(button(container, "Details"));
    expect(
      container.querySelector('[data-testid="created-contracts"]')?.textContent,
    ).toContain("2:7");
  });

  it("shows the contract and its drawing size once the game has one", async () => {
    const container = await panel(fakeApi());
    await settle(() =>
      expect(
        container.querySelector('[data-testid="contract-address"]')
          ?.textContent,
      ).toBe("Contract rewards-1. It keeps drawings up to 4096 bytes."),
    );
    expect(textOf(container)).toContain("Auth token output");
    expect(button(container, "Create the contract")).toBeNull();
    expect(step().operation).toBe("set-claims-paused");
  });

  it("loads the record again when a step ends, so a contract that was just made appears", async () => {
    const pending = creating({ state: "pending", toSign: null });
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        contract: null,
        steps: [pending],
        templatesReady: true,
      })
      .mockResolvedValue(listing([{ ...pending, state: "complete" }]));
    const refresh = vi.fn(async () => ({
      status: "ok" as const,
      step: { ...pending, state: "complete" as const },
    }));
    const container = await panel(fakeApi({ list, refresh }), { pollMs: 10 });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="contract-address"]'),
      ).not.toBeNull(),
    );
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
