import { chainOptionSchema, type ChainOption } from "@ador/shared/chain";

// CAIP-2 identifies a Bitcoin chain as `bip122:` plus the first 16 bytes (32 hex characters) of its
// genesis block hash (https://namespaces.chainagnostic.org/bip122/caip2). Signet's genesis hash is
// 00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6, asserted in Bitcoin Core's
// chain parameters (src/kernel/chainparams.cpp, default signet).
export const bitcoinSignetChainId = "bip122:00000008819873e925422c1ff0f99f7c";

// The chains a collection draft may target in the beta: Bitcoin signet only (ADR-008 keeps mainnet
// behind its own readiness gate). This is the projection of `ChainConfig` that needs no confirmation
// policy; the full records, with per-operation finality, arrive when D22 is accepted (W7-00) and this
// list is then derived from them.
export const targetChains: readonly ChainOption[] = [
  chainOptionSchema.parse({
    chainId: bitcoinSignetChainId,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];
