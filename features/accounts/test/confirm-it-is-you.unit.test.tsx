// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// The harness comes first: it puts the stand-in wallet connection in place before anything that reads one is loaded.
import {
  address,
  answers,
  challenge,
  chooser,
  click,
  connection,
  container,
  denied,
  json,
  methods,
  requests,
  settle,
  show,
} from "./support/widget-harness.tsx";
import { ConfirmItIsYou } from "../src/roles/confirm-it-is-you.tsx";
import { accountOutcomes } from "@ador/shared/account-outcomes";

const stepUp = {
  "/api/v1/auth/methods": () => methods([address]),
  "/api/v1/auth/wallet/step-up/challenge": () => challenge(),
  "/api/v1/auth/wallet/step-up/verify": () => json({ changed: true }),
};
const paths = () => requests.map(({ path }) => path);

describe("confirming it is you, in place", () => {
  it("signs again with the connected wallet and then lets the change run again", async () => {
    Object.assign(connection, { address, connected: true });
    Object.assign(answers, stepUp);
    const onConfirmed = vi.fn();
    await show(<ConfirmItIsYou onConfirmed={onConfirmed} />);
    expect(onConfirmed).not.toHaveBeenCalled();
    await click("Sign again to confirm");
    expect(paths()).toContain("/api/v1/auth/wallet/step-up/challenge");
    expect(paths()).toContain("/api/v1/auth/wallet/step-up/verify");
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("does not run the change again when the signature is refused, and says why", async () => {
    Object.assign(connection, { address, connected: true });
    Object.assign(answers, {
      ...stepUp,
      "/api/v1/auth/wallet/step-up/verify": () =>
        denied("invalid_request", 400, "wallet-not-verified"),
    });
    const onConfirmed = vi.fn();
    await show(<ConfirmItIsYou onConfirmed={onConfirmed} />);
    await click("Sign again to confirm");
    await settle();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      accountOutcomes["wallet-not-verified"].message,
    );
  });

  it("asks for the wallet to be connected first when none is, and does not sign", async () => {
    Object.assign(connection, { address: "", connected: false });
    Object.assign(answers, stepUp);
    const onConfirmed = vi.fn();
    await show(<ConfirmItIsYou onConfirmed={onConfirmed} />);
    await click("Connect your wallet to confirm");
    expect(chooser.request).toHaveBeenCalledTimes(1);
    expect(paths()).not.toContain("/api/v1/auth/wallet/step-up/challenge");
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
