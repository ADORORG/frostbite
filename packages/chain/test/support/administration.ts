import { Psbt } from "bitcoinjs-lib";
import type {
  FundingPolicy,
  SignedTransaction,
  TransactionIntent,
  UnsignedTransaction,
} from "@ador/shared/chain";

import {
  bundleFormat,
  decodeBundle,
  encodeBundle,
} from "../../src/bitcoin-alkanes/admin/bundle.ts";
import { sha256Hex } from "../../src/bitcoin-alkanes/admin/data.ts";
import {
  templateKey,
  type AdminOptions,
} from "../../src/bitcoin-alkanes/admin/templates.ts";
import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { psbtFormat } from "../../src/bitcoin-alkanes/format.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { signRemaining } from "./admin.ts";
import {
  chain,
  family,
  idA,
  idB,
  options,
  utxo,
  walletScript,
  wallet,
} from "./claims.ts";
import { fakeNode } from "./nodes.ts";

export const gameCode = Uint8Array.from({ length: 3000 }, (_v, i) => i % 251);
const collectibleCode = Uint8Array.from({ length: 900 }, (_v, i) => i % 13);
export const gameKey = templateKey("game-rewards", "1.0.0");
export const collectibleKey = templateKey("milestone-collectible", "1.0.0");

export const administration: AdminOptions = {
  collectibleTemplate: collectibleKey,
  maxCodeBytes: 10_000,
  maxDrawingBytes: 4096n,
  random: (length) => new Uint8Array(length).fill(7),
  templates: new Map([
    [
      gameKey,
      {
        alkane: { block: 4n, tx: 2000n },
        codeHash: sha256Hex(gameCode),
        load: () => Promise.resolve(gameCode),
        readOnlyOpcode: 99n,
      },
    ],
    [
      collectibleKey,
      {
        alkane: { block: 4n, tx: 1000n },
        codeHash: sha256Hex(collectibleCode),
        load: () => Promise.resolve(collectibleCode),
        readOnlyOpcode: 99n,
      },
    ],
  ]),
};

export const tokenId = { block: 2n, tx: 9n };
// The token's output, and a second output that pays for steps.
export const tokenOutpoint = `${idA}:0`;
const littleEndian = (value: bigint) =>
  Array.from({ length: 16 }, (_v, i) =>
    Number((value >> BigInt(8 * i)) & 255n),
  );

export function adminNode(overrides: Partial<AlkanesNode> = {}): AlkanesNode {
  return fakeNode({
    feeRate: () => Promise.resolve(2),
    holdings: () =>
      Promise.resolve({
        alkanes: [{ amount: 1n, id: tokenId }],
        script: walletScript,
        value: 1_000n,
      }),
    utxos: () =>
      Promise.resolve([utxo(idA, 0, 1_000n), utxo(idB, 0, 100_000n)]),
    view: () =>
      Promise.resolve({
        data: Uint8Array.from([
          ...littleEndian(tokenId.block),
          ...littleEndian(tokenId.tx),
        ]),
        fuelUsed: 0n,
        ok: true,
      }),
    ...overrides,
  });
}

export const adminChains = (node: AlkanesNode = adminNode()) =>
  new Map<typeof chain, ServedChain>([[chain, { network: "mainnet", node }]]);
export const adminBuilder = (node?: AlkanesNode) =>
  createTransactionBuilder(adminChains(node), options, family, administration);
export const funding: FundingPolicy = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 100_000n },
};

const base = {
  chain,
  extension: { adminOutput: tokenOutpoint },
  sender: wallet,
} as const;
const contract = { chain, family, id: "2:5" };
export const intents = {
  define: {
    ...base,
    claimLimit: 2,
    contract,
    drawing: "<svg xmlns='http://www.w3.org/2000/svg'/>",
    milestoneId: "first-frost",
    operation: "define-milestone",
  },
  defineNoDrawing: {
    ...base,
    claimLimit: 2,
    contract,
    milestoneId: "first-frost",
    operation: "define-milestone",
  },
  deploy: {
    ...base,
    operation: "deploy",
    templateId: "game-rewards",
    templateVersion: "1.0.0",
  },
  pause: {
    ...base,
    contract,
    operation: "set-claims-paused",
    paused: true,
  },
  publish: {
    ...base,
    operation: "publish-template",
    templateId: "game-rewards",
    templateVersion: "1.0.0",
  },
} satisfies Record<string, TransactionIntent>;

// The staff wallet's part, for a step of one transaction or two.
export function signAdmin(unsigned: UnsignedTransaction): SignedTransaction {
  const head = { chain: unsigned.chain, family: unsigned.family };
  if (unsigned.format === bundleFormat) {
    const bundle = decodeBundle(unsigned.payload);
    if (bundle === null) throw new Error("not a bundle");
    return {
      ...head,
      format: bundleFormat,
      payload: encodeBundle({
        commit: signRemaining(bundle.commit),
        reveal: signRemaining(bundle.reveal),
      }),
    };
  }
  return {
    ...head,
    format: psbtFormat,
    payload: signRemaining(Psbt.fromBase64(unsigned.payload)).toBase64(),
  };
}
