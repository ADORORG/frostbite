import { ExplorerBoundary } from "@frostbite/feature-chain-status/transaction";
import { button, click, mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { GameAdminPanel } from "../src/ui/game-admin-panel.tsx";
import { fakeApi, step } from "./support/fake-api.ts";
import { enterWallet } from "./support/panel.tsx";
import { info } from "./support/fixtures.ts";

const commit = "a".repeat(64);
const reveal = "b".repeat(64);
const template = "https://explorer.test/tx/{id}";

async function sentStep(over: Parameters<typeof step>[0], boundary = true) {
  const game = info()[0];
  if (game === undefined) throw new Error("no game");
  const api = fakeApi({
    start: async () => ({
      resumed: false,
      status: "started" as const,
      step: step({ toSign: null, ...over }),
    }),
  });
  const panel = <GameAdminPanel api={api} game={game} />;
  const container = await mount(
    boundary ? (
      <ExplorerBoundary txUrl={template}>{panel}</ExplorerBoundary>
    ) : (
      panel
    ),
  );
  await enterWallet(container);
  await click(button(container, "Pause claims"));
  return container;
}

const links = (container: HTMLElement) =>
  [...container.querySelectorAll("a")].filter((a) =>
    a.href.startsWith("https://explorer.test/"),
  );

describe("the transactions of a sent step, in the sheet it is followed in", () => {
  it("lists the commit and the reveal by id, each linking to the explorer", async () => {
    const container = await sentStep({
      state: "pending",
      transactionId: reveal,
      transactions: [
        { id: commit, role: "commit" },
        { id: reveal, role: "reveal" },
      ],
    });
    const text = textOf(container);
    expect(text).toContain("Commit transaction");
    expect(text).toContain("Reveal transaction");
    expect(links(container).map((a) => [a.textContent, a.href])).toEqual([
      [commit, `https://explorer.test/tx/${commit}`],
      [reveal, `https://explorer.test/tx/${reveal}`],
    ]);
    const first = links(container)[0];
    expect(first?.target).toBe("_blank");
    expect(first?.rel).toContain("noopener");
  });

  it("shows the ids as text when no explorer is configured, and nothing before the step is signed", async () => {
    const bare = await sentStep(
      {
        state: "pending",
        transactions: [{ id: commit, role: "transaction" }],
      },
      false,
    );
    expect(links(bare)).toEqual([]);
    expect(textOf(bare)).toContain(commit);
    const unsigned = await sentStep({ transactions: [] });
    expect(textOf(unsigned)).not.toContain("Transactions on the network");
  });

  it("says plainly that a send the network has not been seen to hold may not have arrived", async () => {
    const waiting = await sentStep({
      state: "pending",
      transactions: [{ id: commit, role: "transaction" }],
      unconfirmedSend: true,
    });
    expect(
      waiting.querySelector('[data-testid="unconfirmed-send"]')?.textContent,
    ).toContain("may not have arrived");
    const settled = await sentStep({
      state: "pending",
      transactions: [{ id: commit, role: "transaction" }],
    });
    expect(
      settled.querySelector('[data-testid="unconfirmed-send"]'),
    ).toBeNull();
  });
});
