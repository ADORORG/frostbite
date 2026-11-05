import type { ChainRef } from "@frostbite/shared/chain";

import type { ChainAdapter } from "../adapter.ts";
import type { BitcoinNetwork } from "../bitcoin/address.ts";
import { templateReadOnlyOpcodes } from "./admin/calls.ts";
import { templateKey, type TemplateEntry } from "./admin/templates.ts";
import {
  createBitcoinAlkanesAdapter,
  type BitcoinAlkanesNodes,
} from "./adapter.ts";
import {
  createFeeSource,
  type FeeSource,
  type FeeSourceSettings,
} from "../fee-sources/index.ts";
import { createRpcNode } from "./node/node.ts";
import { createJsonRpc, type FetchLike } from "./node/transport.ts";
import type { TransactionOptions } from "./options.ts";

// A template the platform may publish, as configuration states it. Its file is `<crate>.wasm` in the templates directory, and
// `codeHash` is the SHA-256 of that file as released (`contracts/templates/release.json`), checked before anything is built.
export interface TemplateSetting {
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
      return [
        templateKey(setting.crate, setting.version),
        {
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
  // Where fee rates come from, in place of the node's own estimates:
  // - `explorer`: a public explorer's quote, in the format named (see `fee-sources`);
  // - `fixed`: a rate the operator set, for when no explorer can be reached;
  // - `null`: the node's estimates are used (a chain whose node prices fees sensibly, such as a local regtest).
  readonly feeApi: FeeSourceSettings | null;
  readonly maxPreviewBytes: number;
  readonly network: BitcoinNetwork;
  readonly now: () => Date;
  readonly rpc: {
    readonly fetch: FetchLike;
    // The node's key header, when it asks for one; empty otherwise. Secret: never log it.
    readonly headers: Readonly<Record<string, string>>;
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
            headers: settings.rpc.headers,
            timeoutMs: settings.rpc.timeoutMs,
            url: settings.rpc.url,
          }),
          feeSourceOf(settings.feeApi),
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

function feeSourceOf(source: FeeSourceSettings | null): FeeSource | undefined {
  return source === null ? undefined : createFeeSource(source);
}
