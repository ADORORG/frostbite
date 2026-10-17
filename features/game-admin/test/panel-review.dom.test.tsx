import {
  button,
  click,
  fieldByLabel,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { apiError, fakeApi } from "./support/fake-api.ts";
import { enterWallet, panel } from "./support/panel.tsx";

describe("reviewing and sending a step", () => {
  async function review(api = fakeApi(), extra = {}) {
    const container = await panel(api, extra);
    await enterWallet(container);
    await click(button(container, "Pause claims"));
    return container;
  }

  it("shows exactly what the step does, and how to sign it elsewhere when no wallet signs", async () => {
    const container = await review();
    const dialog = container.querySelector('[data-testid="step-review"]');
    expect(dialog?.textContent).toContain("rewards-1");
    expect(dialog?.textContent).toContain("1 sim");
    expect(dialog?.textContent).toContain("paused");
    expect(dialog?.textContent).toContain(
      "no wallet connection that signs administration steps",
    );
    expect(button(container, "Sign with your wallet")).toBeNull();
    expect(fieldByLabel(container, "Transaction to sign").value).toBe("{}");
  });

  it("sends the signed transaction that was pasted, joined to the transaction that was shown", async () => {
    const api = fakeApi();
    const container = await review(api);
    await click(button(container, "Send signed transaction"));
    expect(textOf(container)).toContain("Paste the signed transaction first.");
    expect(api.submit).not.toHaveBeenCalled();
    await typeInto(
      fieldByLabel(container, "Signed transaction"),
      "  {}.sig \n",
    );
    await click(button(container, "Send signed transaction"));
    expect(api.submit).toHaveBeenCalledWith({
      signed: {
        chain: "simnet:one",
        family: "simulated",
        format: "sim-json/1",
        payload: "{}.sig",
      },
      stepId: "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
    });
    expect(textOf(container)).toContain("Sent, waiting");
    // Once sent there is nothing left to sign or paste.
    expect(
      container
        .querySelector('[data-testid="step-review"]')
        ?.querySelector("textarea"),
    ).toBeNull();
  });

  it("signs with the wallet when there is one, and sends what it signed", async () => {
    const api = fakeApi();
    const sign = vi.fn(async (t) => ({ ...t, payload: `${t.payload}.sig` }));
    const container = await review(api, { sign });
    await click(button(container, "Sign with your wallet"));
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ payload: "{}" }),
    );
    expect(api.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        signed: expect.objectContaining({ payload: "{}.sig" }),
      }),
    );
  });

  it("says nothing was signed when the wallet gave nothing back, that the wallet did not sign when it refused, and that the platform could not be reached when the send failed", async () => {
    const nothing = await review(fakeApi(), { sign: vi.fn(async () => null) });
    await click(button(nothing, "Sign with your wallet"));
    expect(textOf(nothing)).toContain("Nothing was signed.");
    const broken = await review(fakeApi(), {
      sign: vi.fn(async () => {
        throw new Error("x");
      }),
    });
    await click(button(broken, "Sign with your wallet"));
    expect(textOf(broken)).toContain("Your wallet did not sign");
    expect(button(broken, "Sign with your wallet")?.disabled).toBe(false);
    const unreachable = await review(
      fakeApi({
        submit: vi.fn(async () => {
          throw apiError("network");
        }),
      }),
      { sign: vi.fn(async (transaction) => transaction) },
    );
    await click(button(unreachable, "Sign with your wallet"));
    expect(textOf(unreachable)).toContain("could not be reached");
  });

  it.each([
    ["invalid-signature", "not what was shown"],
    ["expired", "not signed in time"],
    ["not-awaiting-signature", "can no longer be signed"],
    ["not-found", "could not be found"],
    ["chain-unavailable", "network could not be reached"],
  ] as const)("says why a send was refused: %s", async (reason, words) => {
    const container = await review(
      fakeApi({
        submit: vi.fn(async () => ({ reason, status: "refused" as const })),
      }),
    );
    await typeInto(fieldByLabel(container, "Signed transaction"), "x");
    await click(button(container, "Send signed transaction"));
    expect(textOf(container)).toContain(words);
  });

  it("says the platform could not be reached when a send fails, and closes the review on request", async () => {
    const container = await review(
      fakeApi({
        submit: vi.fn(async () => {
          throw apiError("network");
        }),
      }),
    );
    await typeInto(fieldByLabel(container, "Signed transaction"), "x");
    await click(button(container, "Send signed transaction"));
    expect(textOf(container)).toContain("could not be reached");
    await click(button(container, "Close"));
    expect(container.querySelector('[data-testid="step-review"]')).toBeNull();
  });
});
