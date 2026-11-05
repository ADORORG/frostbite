// @vitest-environment jsdom
import { accountOutcomes } from "@frostbite/shared/account-outcomes";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  address,
  answers,
  challenge,
  chooser,
  connection,
  container,
  denied,
  json,
  methods,
  requests,
  settle,
  show,
} from "./support/widget-harness.tsx";
// After the harness, whose stand-in for the wallet library must be in place before the component loads.
import { WalletSignIn } from "../src/sign-in/wallet-sign-in.tsx";

const onSignedIn = vi.fn();
const view = (network: "signet" | "mainnet" = "signet") => (
  // A new function on every render, as the sign-in surface gives it: moving on must still happen once.
  <WalletSignIn expectedNetwork={network} onSignedIn={() => onSignedIn()} />
);
const press = (name: string) =>
  act(async () => {
    [...container.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === name)
      ?.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });

describe("signing in with a wallet on the sign-in page", () => {
  it("asks to connect a wallet first, and opens the chooser when asked", async () => {
    onSignedIn.mockClear();
    answers["/api/v1/auth/methods"] = () => denied("unauthorized", 401);
    await show(view());
    await settle();
    expect(container.textContent).toContain("Connect your Bitcoin wallet");
    await press("Connect wallet");
    expect(chooser.request).toHaveBeenCalledTimes(1);
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("signs in with the connected wallet, says signed in only after the server did, and moves on exactly once", async () => {
    onSignedIn.mockClear();
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    let signedIn = false;
    Object.assign(answers, {
      "/api/v1/auth/methods": () =>
        signedIn ? methods([address]) : denied("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": challenge,
      "/api/v1/auth/wallet/verify": () => {
        signedIn = true;
        return json({ signedIn: true });
      },
    });
    await show(view());
    await settle();
    expect(container.textContent).toContain("xverse connected");
    expect(container.textContent).not.toContain("Signed in. Taking you back");
    expect(onSignedIn).not.toHaveBeenCalled();
    await press("Sign in with wallet");
    expect(container.textContent).toContain("Signed in. Taking you back…");
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(
      requests
        .map(({ path }) => path)
        .filter((path) => path !== "/api/v1/wallet/balance"),
    ).toEqual([
      "/api/v1/auth/methods",
      "/api/v1/auth/wallet/challenge",
      "/api/v1/auth/wallet/verify",
      "/api/v1/auth/methods",
    ]);
  });

  it("moves on at once, with nothing to press, for a visitor who is already signed in", async () => {
    onSignedIn.mockClear();
    answers["/api/v1/auth/methods"] = () => methods([address]);
    await show(view());
    await settle();
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Signed in. Taking you back…");
    // The page renders again before the navigation has finished; it must not start another.
    await show(view());
    await settle();
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("stays put and says why when the wallet did not sign or the server did not verify", async () => {
    onSignedIn.mockClear();
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => denied("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": challenge,
      "/api/v1/auth/wallet/verify": () =>
        denied("unauthorized", 401, "wallet-not-verified"),
    });
    await show(view());
    await settle();
    await press("Sign in with wallet");
    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      accountOutcomes["wallet-not-verified"].message,
    );
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Signed in. Taking you back");
  });

  it("warns when the wallet is on another network than the platform's", async () => {
    onSignedIn.mockClear();
    Object.assign(connection, { address, connected: true, provider: "unisat" });
    answers["/api/v1/auth/methods"] = () => denied("unauthorized", 401);
    await show(view("mainnet"));
    await settle();
    expect(container.textContent).toContain(
      "Your wallet is on Signet; this platform uses Mainnet.",
    );
    connection.network = "mainnet";
    await show(view("mainnet"));
    await settle();
    expect(container.textContent).not.toContain("Your wallet is on");
  });
});
