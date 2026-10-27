import { chainRefSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import type { ServedChain } from "../../src/bitcoin-alkanes/chains.ts";
import { createObserver } from "../../src/bitcoin-alkanes/observer.ts";
import { chain, options } from "../support/claims.ts";
import { fakeNode } from "../support/nodes.ts";

const served = (tip: number, indexed: number) =>
  new Map<typeof chain, ServedChain>([
    [
      chain,
      {
        network: "mainnet",
        node: fakeNode({
          indexedHeight: () => Promise.resolve(indexed),
          tip: () => Promise.resolve({ hash: "cc".repeat(32), height: tip }),
        }),
      },
    ],
  ]);

describe("how far the indexer has read", () => {
  it("reports the chain's tip and the indexer's height, for the chain asked about, at the time it was read", async () => {
    const observer = createObserver(served(326_770, 325_681), options);
    expect(await observer.indexing(chain)).toEqual({
      chain,
      indexedHeight: 325_681,
      observedAt: options.now().toISOString(),
      tipHeight: 326_770,
    });
  });

  it("refuses a chain it does not serve, and fails when the node cannot be asked", async () => {
    const observer = createObserver(served(1, 1), options);
    await expect(
      observer.indexing(
        chainRefSchema.parse("bip122:ffffffffffffffffffffffffffffffff"),
      ),
    ).rejects.toThrow();
    const down = createObserver(
      new Map<typeof chain, ServedChain>([
        [chain, { network: "mainnet", node: fakeNode() }],
      ]),
      options,
    );
    await expect(down.indexing(chain)).rejects.toThrow("was not expected");
  });

  it("reports the chain's tip alone, even when the indexer cannot be asked", async () => {
    const observer = createObserver(
      new Map<typeof chain, ServedChain>([
        [
          chain,
          {
            network: "mainnet",
            node: fakeNode({
              indexedHeight: () => Promise.reject(new Error("indexer down")),
              tip: () =>
                Promise.resolve({ hash: "cc".repeat(32), height: 326_770 }),
            }),
          },
        ],
      ]),
      options,
    );
    expect(await observer.tip(chain)).toBe(326_770);
    await expect(observer.indexing(chain)).rejects.toThrow("indexer down");
    await expect(
      observer.tip(
        chainRefSchema.parse("bip122:ffffffffffffffffffffffffffffffff"),
      ),
    ).rejects.toThrow();
  });
});
