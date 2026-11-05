// @vitest-environment jsdom
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

// The harness comes first: it puts the stand-in wallet connection in place before anything that reads one is loaded.
import {
  address,
  answers,
  button,
  challenge,
  chooser,
  click,
  connection,
  container,
  denied,
  json,
  methods,
  requests,
  second,
  settle,
  show,
} from "./support/widget-harness.tsx";
import { AccountSurface } from "../src/ui/account-surface.tsx";
import { WalletPanel } from "../src/ui/wallet-panel.tsx";
import { accountOutcomes } from "@frostbite/shared/account-outcomes";
import { emailView } from "./support/email-view.ts";

const panel = (otherWays = 0) =>
  show(<WalletPanel expectedNetwork="signet" otherWays={otherWays} />);
const text = () => container.textContent;
const alert = () => container.querySelector('[role="status"]')?.textContent;

describe("the wallets card on the account page", () => {
  it("lists the account's wallets with how many there are, and marks the one connected in this browser", async () => {
    Object.assign(connection, { address, connected: true });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address, second]),
    });
    await panel();
    await settle();
    expect(
      container.querySelectorAll('[aria-label="Linked wallets"] li'),
    ).toHaveLength(2);
    expect(container.querySelector(".console-card__count")?.textContent).toBe(
      "2",
    );
    expect(text()).toContain("connected in this browser");
    // Only the connected one is marked.
    expect(text()?.match(/connected in this browser/gu)).toHaveLength(1);
  });

  it("says so when no wallet is linked, and offers to connect one, which opens the chooser", async () => {
    Object.assign(answers, { "/api/v1/auth/methods": () => methods([]) });
    await panel(1);
    await settle();
    expect(text()).toContain("No wallet is linked to this account yet.");
    await click("Connect a wallet");
    expect(chooser.request).toHaveBeenCalledOnce();
  });

  it("says it is reading while it asks, and not that there is no wallet", async () => {
    Object.assign(answers, {
      "/api/v1/auth/methods": () => new Promise<Response>(() => undefined),
    });
    await panel();
    await settle();
    expect(text()).toContain("Reading your wallets");
    expect(text()).not.toContain("No wallet is linked");
  });

  it("says it could not read the wallets, rather than showing an empty list as if it were true", async () => {
    Object.assign(answers, {
      "/api/v1/auth/methods": () => denied("internal_error", 500),
    });
    await panel();
    await settle();
    expect(text()).toContain("Your wallets could not be read.");
    expect(text()).not.toContain("No wallet is linked");
  });

  it("offers to link the connected wallet when it is not on the account, and shows it linked only after the server did", async () => {
    Object.assign(connection, {
      address: second,
      connected: true,
      provider: "xverse",
    });
    let linked = false;
    Object.assign(answers, {
      "/api/v1/auth/methods": () =>
        methods(linked ? [address, second] : [address]),
      "/api/v1/auth/wallet/link/challenge": challenge,
      "/api/v1/auth/wallet/link/verify": () => {
        linked = true;
        return json({ changed: true });
      },
    });
    await panel(0);
    await settle();
    expect(
      container.querySelectorAll('[aria-label="Linked wallets"] li'),
    ).toHaveLength(1);
    await click("Link tb1qse");
    expect(
      container.querySelectorAll('[aria-label="Linked wallets"] li'),
    ).toHaveLength(2);
    // Nothing is offered to link once it is linked.
    expect(button("Link tb1qse")).toBeUndefined();
    expect(button("Connect another wallet")).toBeDefined();
  });

  it.each([
    ["is already linked to a different account", "wallet-on-another-account"],
    ["was recently removed from an account", "wallet-held"],
  ] as const)("says why when the wallet %s", async (_why, outcome) => {
    Object.assign(connection, {
      address: second,
      connected: true,
      provider: "xverse",
    });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/wallet/link/challenge": challenge,
      "/api/v1/auth/wallet/link/verify": () => denied("conflict", 409, outcome),
    });
    await panel(0);
    await settle();
    await click("Link tb1qse");
    expect(alert()).toBe(accountOutcomes[outcome].message);
  });

  it("lets a wallet be removed while it is not the last way in, and withholds it, saying why, when it is", async () => {
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
    });
    await panel(0);
    await settle();
    expect(button("Remove")).toBeUndefined();
    expect(text()).toContain("only way to sign in");
    // Another way in (a passkey or an email address) makes it removable.
    await panel(1);
    await settle();
    expect(button("Remove")).toBeDefined();
    expect(text()).not.toContain("only way to sign in");
  });

  it("removes the wallet that was asked about and no other", async () => {
    const [idFirst, idSecond] = [createUuidV7(), createUuidV7()];
    const entry = (walletAddress: string, id: string) => ({
      address: walletAddress,
      id,
      linkedAt: "2026-10-13T12:00:00.000Z",
      network: "signet",
      walletAdapter: "xverse",
    });
    let wallets = [entry(address, idFirst), entry(second, idSecond)];
    Object.assign(answers, {
      "/api/v1/auth/methods": () =>
        json({ passkeys: [], recentAuthentication: true, wallets }),
      "/api/v1/auth/wallet/unlink": () => {
        wallets = [entry(address, idFirst)];
        return json({ changed: true });
      },
    });
    await panel(0);
    await settle();
    await click(`Remove ${second.slice(0, 6)}`);
    expect(
      requests.find(({ path }) => path === "/api/v1/auth/wallet/unlink")?.body,
    ).toEqual({ walletId: idSecond });
    expect(
      container.querySelectorAll('[aria-label="Linked wallets"] li'),
    ).toHaveLength(1);
    expect(text()).toContain(address.slice(0, 6));
  });

  it("is given the account's other ways in by the account page, so a wallet beside a passkey or an email address can be removed", async () => {
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
    });
    const account = (passkeys: string[], emails: string[] | null) =>
      show(
        <AccountSurface
          actorUserId={createUuidV7()}
          emailAddresses={emails === null ? null : emailView(emails)}
          expectedNetwork="signet"
          passkeyCredentialIds={passkeys}
        />,
      );
    await account([], null);
    await settle();
    expect(button(`Remove ${address.slice(0, 6)}`)).toBeUndefined();
    await account(["k"], null);
    await settle();
    expect(button(`Remove ${address.slice(0, 6)}`)).toBeDefined();
    await account([], ["a@b.co"]);
    await settle();
    expect(button(`Remove ${address.slice(0, 6)}`)).toBeDefined();
  });

  it("asks to sign again when the change needs a recent signature", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address, second]),
      "/api/v1/auth/wallet/unlink": () =>
        denied("forbidden", 403, "recent-authentication-required"),
    });
    await panel(0);
    await settle();
    await click(`Remove ${second.slice(0, 6)}`);
    expect(text()).toContain(
      accountOutcomes["recent-authentication-required"].message,
    );
    expect(button("Sign again to confirm")).toBeDefined();
  });

  it("flags a wallet on another network than the platform's", async () => {
    Object.assign(connection, { address, connected: true, network: "mainnet" });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
    });
    await panel(0);
    await settle();
    expect(text()).toContain(
      "Your wallet is on Mainnet; this platform uses Signet.",
    );
  });
});
