import type { TransactionIntent } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { parseAlkaneId } from "../src/bitcoin-alkanes/node/alkane-id.ts";
import { ensureAuthTokenFactory } from "./auth-token-factory.ts";
import {
  core,
  family,
  mine,
  newAddress,
  node,
  regtest,
  regtestChain,
  runStep,
} from "./stack.ts";

// The whole life of a game's rewards contract on a real chain: the adapter builds each step, a wallet signs it, Bitcoin Core accepts
// it, a block holds it, and the real Alkanes indexer runs it. Nothing here is simulated.
describe("the rewards lifecycle on regtest", () => {
  it("publishes both templates, creates a game, defines a milestone and takes a claim, each confirmed by the indexer", async () => {
    const chain = await regtest();
    const staffAddress = await newAddress();
    await core.call("sendtoaddress", [staffAddress, 5]);
    await mine(1);
    const sender = { chain: regtestChain, value: staffAddress };
    const at = (id: string) => ({ chain: regtestChain, family, id });
    const base = { chain: regtestChain, sender } as const;
    // A chain keeps what was published on it, so each run publishes at addresses no earlier run used.
    const first = 10_000 + (Date.now() % 1_000_000);
    const gameTemplate = `4:${first}`;
    const collectibleTemplate = `4:${first + 1}`;

    const step = (intent: TransactionIntent) =>
      runStep({ ...chain.ports, funding: chain.funding }, intent);
    await ensureAuthTokenFactory(chain, sender);

    await step({
      ...base,
      operation: "publish-template",
      templateAt: at(gameTemplate),
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    });
    await step({
      ...base,
      operation: "publish-template",
      templateAt: at(collectibleTemplate),
      templateId: "milestone-collectible",
      templateVersion: "1.0.0",
    });
    expect((await chain.ports.contracts.inspect(at(gameTemplate))).exists).toBe(
      true,
    );

    const created = await step({
      ...base,
      collectibleAt: at(collectibleTemplate),
      maxDrawingBytes: 2048,
      operation: "deploy",
      templateAt: at(gameTemplate),
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    });
    const [gameId, tokenId] = created.seen.created ?? [];
    expect(gameId).toMatch(/^2:\d+$/u);
    expect(tokenId).toMatch(/^2:\d+$/u);
    const game = at(gameId ?? "");
    const inspected = await chain.ports.contracts.inspect(game);
    expect(inspected.exists).toBe(true);

    // The auth token lands on one of a step's outputs and comes back on one of the next step's; steps on the game spend it.
    const token = parseAlkaneId(tokenId ?? "");
    async function tokenOutput(txid: string): Promise<string> {
      for (let vout = 0; vout < 4; vout += 1) {
        const held = await node.holdings(txid, vout);
        if (
          held.alkanes.some(
            ({ id }) => id.block === token?.block && id.tx === token.tx,
          )
        )
          return `${txid}:${vout}`;
      }
      throw new Error(`the auth token is on no output of ${txid}`);
    }
    const drawing =
      "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='#0af'/></svg>";

    const defined = await step({
      ...base,
      claimLimit: 2,
      contract: game,
      drawing,
      extension: { adminOutput: await tokenOutput(created.txid) },
      milestoneId: "first-frost",
      operation: "define-milestone",
    });

    // A player, with coins of their own, claims the milestone and holds a collectible whose picture is the drawing.
    const playerAddress = await newAddress();
    await core.call("sendtoaddress", [playerAddress, 1]);
    await mine(1);
    const player = { chain: regtestChain, value: playerAddress };
    const claimed = await step({
      chain: regtestChain,
      contract: game,
      milestoneId: "first-frost",
      operation: "mint-milestone",
      sender: player,
    });
    expect(await chain.ports.rewards.claimed(game, player, "first-frost")).toBe(
      1,
    );
    const [collectibleId] = claimed.seen.created ?? [];
    const preview = await chain.ports.rewards.preview(at(collectibleId ?? ""));
    expect(preview?.issuer.id).toBe(game.id);
    // The collectible frames the drawing in a card and numbers it.
    const picture = new TextDecoder().decode(preview?.bytes);
    expect(picture).toContain(drawing);
    expect(picture).toContain("#001");

    // Staff pause claims: a second player is refused, and succeeds after claims are resumed.
    const paused = await step({
      ...base,
      contract: game,
      extension: { adminOutput: await tokenOutput(defined.txid) },
      operation: "set-claims-paused",
      paused: true,
    });
    const second = { chain: regtestChain, value: await newAddress() };
    await core.call("sendtoaddress", [second.value, 1]);
    await mine(1);
    const claim = {
      chain: regtestChain,
      contract: game,
      milestoneId: "first-frost",
      operation: "mint-milestone",
      sender: second,
    } as const;
    await expect(step(claim)).rejects.toThrow("reverted");
    await step({
      ...base,
      contract: game,
      extension: { adminOutput: await tokenOutput(paused.txid) },
      operation: "set-claims-paused",
      paused: false,
    });
    await step(claim);
    expect(await chain.ports.rewards.claimed(game, second, "first-frost")).toBe(
      1,
    );
  });
});
