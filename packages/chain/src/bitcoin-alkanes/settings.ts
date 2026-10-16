import type { ChainRef } from "@ador/shared/chain";

import type { ChainAdapter } from "../adapter.ts";
import type { BitcoinNetwork } from "../bitcoin/address.ts";
import { templateReadOnlyOpcodes } from "./admin/calls.ts";
import { templateKey, type TemplateEntry } from "./admin/templates.ts";
import {
  createBitcoinAlkanesAdapter,
  type BitcoinAlkanesNodes,
} from "./adapter.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { createRpcNode } from "./node/node.ts";
import { createJsonRpc, type FetchLike } from "./node/transport.ts";
import type { TransactionOptions } from "./options.ts";

// A template the platform may publish, as configuration states it. Its file is `<crate>.wasm` in the templates directory, and
// `codeHash` is the SHA-256 of that file as released (`contracts/templates/release.json`), checked before anything is built.
export interface TemplateSetting {
  readonly alkane: string;
  readonly codeHash: string;
  readonly crate: "game-rewards" | "milestone-collectible";
  readonly version: string;
}

const readOnlyOpcode = {
  "game-rewards": templateReadOnlyOpcodes.gameRewards,
  "milestone-collectible": templateReadOnlyOpcodes.collectible,
} as const;

// The templates the adapter may publish, keyed the way its administration looks them up. A wrong Alkane fails boot here, not in
// the middle of a step.
export function templateEntries(
  settings: readonly TemplateSetting[],
  read: (crate: TemplateSetting["crate"]) => Promise<Uint8Array>,
): ReadonlyMap<string, TemplateEntry> {
  return new Map(
    settings.map((setting) => {
      const alkane = parseAlkaneId(setting.alkane);
      if (alkane === null) {
        throw new Error(
          `The Alkane of ${setting.crate} is not block:tx: ${setting.alkane}.`,
        );
      }
      return [
        templateKey(setting.crate, setting.version),
        {
          alkane,
          codeHash: setting.codeHash,
          load: () => read(setting.crate),
          readOnlyOpcode: readOnlyOpcode[setting.crate],
        },
      ];
    }),
  );
}

// What the platform stands behind staff administration with: the templates it may publish, where to load them, and the limits.
export interface AlkanesAdministrationSettings {
  // The template every game's collectibles are created from.
  readonly collectibleTemplate: Pick<TemplateSetting, "crate" | "version">;
  readonly maxCodeBytes: number;
  readonly maxDrawingBytes: bigint;
  readonly random: (length: number) => Uint8Array;
  // Loads a template's built code.
  readonly read: (crate: TemplateSetting["crate"]) => Promise<Uint8Array>;
  readonly templates: readonly TemplateSetting[];
}

// Everything the `bitcoin-alkanes` adapter needs for one chain, from configuration. Nothing here is defaulted: the caller states it.
export interface AlkanesChainSettings {
  // `null`: the adapter reads and builds claims but refuses staff steps.
  readonly administration: AlkanesAdministrationSettings | null;
  readonly chain: ChainRef;
  readonly maxPreviewBytes: number;
  readonly network: BitcoinNetwork;
  readonly now: () => Date;
  readonly rpc: {
    readonly fetch: FetchLike;
    readonly timeoutMs: number;
    readonly url: string;
  };
  readonly transactions: Omit<TransactionOptions, "now" | "providerId">;
}

// What the adapter is wired to, from one chain's settings. The node is named as the source of what it reports by its host, never by
// its full address, which may carry a key.
export function alkanesServices(
  settings: AlkanesChainSettings,
): BitcoinAlkanesNodes {
  const { administration } = settings;
  return {
    ...(administration === null
      ? {}
      : {
          administration: {
            collectibleTemplate: templateKey(
              administration.collectibleTemplate.crate,
              administration.collectibleTemplate.version,
            ),
            maxCodeBytes: administration.maxCodeBytes,
            maxDrawingBytes: administration.maxDrawingBytes,
            random: administration.random,
            templates: templateEntries(
              administration.templates,
              administration.read,
            ),
          },
        }),
    maxPreviewBytes: settings.maxPreviewBytes,
    nodes: new Map([
      [
        settings.chain,
        createRpcNode(
          createJsonRpc({
            fetch: settings.rpc.fetch,
            timeoutMs: settings.rpc.timeoutMs,
            url: settings.rpc.url,
          }),
        ),
      ],
    ]),
    transactions: {
      ...settings.transactions,
      now: settings.now,
      providerId: new URL(settings.rpc.url).host,
    },
  };
}

export function createAlkanesAdapter(
  settings: AlkanesChainSettings,
): ChainAdapter {
  return createBitcoinAlkanesAdapter(
    new Map([[settings.chain, settings.network]]),
    alkanesServices(settings),
  );
}
