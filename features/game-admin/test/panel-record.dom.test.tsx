import {
  button,
  click,
  fieldByLabel,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import {
  apiError,
  creating,
  fakeApi,
  listing,
  step,
} from "./support/fake-api.ts";
import { panel } from "./support/panel.tsx";

const unreadable = () =>
  creating({
    failureReason: "The step ran, but the chain did not say what it made.",
    recordable: true,
    state: "failed",
    toSign: null,
  });

// A game whose creation went through but whose contract the platform could not find, with its log open on that step.
async function opened(api = fakeApi()) {
  const failed = unreadable();
  api.list = vi.fn(async () => ({
    contract: null,
    drawingCeiling: 8192,
    steps: [failed],
    templatesReady: true,
  }));
  const container = await panel(api);
  await settle(() => expect(textOf(container)).toContain("Details"));
  await click(button(container, "Details"));
  return { container, failed };
}

describe("entering the address of a contract the platform could not read", () => {
  it("offers a place to enter it only for a creation that went through, and checks before recording", async () => {
    const { container, failed } = await opened();
    expect(
      container.querySelector('[data-testid="record-address"]'),
    ).not.toBeNull();
    expect(button(container, "Check and record")?.disabled).toBe(true);
    await typeInto(fieldByLabel(container, "Contract address"), " 2:77 ");
    expect(button(container, "Check and record")?.disabled).toBe(false);
    expect(textOf(container)).toContain(failed.failureReason);
  });

  it("sends the address for the step, and shows the contract once the platform has recorded it", async () => {
    const api = fakeApi();
    const { container, failed } = await opened(api);
    const made = {
      ...failed,
      createdContracts: ["2:77"],
      failureReason: null,
      recordable: false,
      recordedBy: "Ada",
      state: "complete" as const,
    };
    api.record = vi.fn(async () => ({
      status: "recorded" as const,
      step: made,
    }));
    api.list = vi.fn(async () => ({
      ...listing([made]),
      contract: { address: "2:77", maxDrawingBytes: 4096 },
    }));
    await typeInto(fieldByLabel(container, "Contract address"), "2:77");
    await click(button(container, "Check and record"));
    expect(api.record).toHaveBeenCalledWith({
      address: "2:77",
      stepId: failed.id,
    });
    await settle(() =>
      expect(
        container.querySelector('[data-testid="contract-address"]')
          ?.textContent,
      ).toContain("Contract 2:77"),
    );
    expect(
      container.querySelector('[data-testid="recorded-by"]')?.textContent,
    ).toBe("The contract's address was entered by Ada.");
    expect(
      container.querySelector('[data-testid="record-address"]'),
    ).toBeNull();
  });

  it("does not let the check be sent twice while it is being made", async () => {
    const api = fakeApi();
    const { container } = await opened(api);
    api.record = vi.fn(() => new Promise<never>(() => undefined));
    await typeInto(fieldByLabel(container, "Contract address"), "2:77");
    await click(button(container, "Check and record"));
    expect(button(container, "Checking…")?.disabled).toBe(true);
  });

  it("says nobody entered an address for a step whose contract the network reported", async () => {
    const { container } = await opened();
    expect(container.querySelector('[data-testid="recorded-by"]')).toBeNull();
  });

  it("says why the platform refused an address, and records nothing", async () => {
    const api = fakeApi();
    const { container } = await opened(api);
    api.record = vi.fn(async () => ({
      reason: "not-on-chain" as const,
      status: "refused" as const,
    }));
    await typeInto(fieldByLabel(container, "Contract address"), "2:77");
    await click(button(container, "Check and record"));
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        "No contract is at that address.",
      ),
    );
    expect(
      container.querySelector('[data-testid="record-address"]'),
    ).not.toBeNull();
  });

  it("says the platform could not be reached, and that nothing was changed, when the request has no answer", async () => {
    const api = fakeApi();
    const { container } = await opened(api);
    api.record = vi.fn(async () => {
      throw apiError("network");
    });
    await typeInto(fieldByLabel(container, "Contract address"), "2:77");
    await click(button(container, "Check and record"));
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "could not be reached while recording the contract's address",
      ),
    );
  });

  it("offers nothing to enter for a step that did not create a contract the platform failed to read", async () => {
    const api = fakeApi();
    api.list = vi.fn(async () => ({
      contract: null,
      drawingCeiling: 8192,
      steps: [creating({ state: "failed", toSign: null })],
      templatesReady: true,
    }));
    const container = await panel(api);
    await settle(() => expect(textOf(container)).toContain("Details"));
    await click(button(container, "Details"));
    expect(
      container.querySelector('[data-testid="record-address"]'),
    ).toBeNull();
    expect(step().recordable).toBe(false);
  });
});
