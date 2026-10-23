import {
  chainOptionSchema,
  type BetaNetwork,
  type ChainOption,
  type WalletNetwork,
} from "@ador/shared/chain";

// CAIP-2 identifies a Bitcoin chain as `bip122:` plus the first 16 bytes (32 hex characters) of its
// genesis block hash (https://namespaces.chainagnostic.org/bip122/caip2). Signet's genesis hash is
// 00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6, asserted in Bitcoin Core's
// chain parameters (src/kernel/chainparams.cpp, default signet).
export const bitcoinSignetChainId = "bip122:00000008819873e925422c1ff0f99f7c";

// Testnet4's genesis hash is 00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043 (BIP-94;
// chainparams.cpp, CTestNet4Params), the same block the Subfrost gateway answers for height 0.
export const bitcoinTestnet4ChainId = "bip122:00000000da84f2bafbbc53dee25a72ae";

// The test networks the beta can run on. Each is a chain record and the wallet network a person's wallet
// must be on to use it.
export const betaChains = {
  signet: {
    chain: chainOptionSchema.parse({
      chainId: bitcoinSignetChainId,
      displayName: "Bitcoin signet",
      enabled: true,
      family: "bitcoin-alkanes",
      role: "public-beta",
    }),
    network: "signet",
  },
  testnet4: {
    chain: chainOptionSchema.parse({
      chainId: bitcoinTestnet4ChainId,
      displayName: "Bitcoin testnet4",
      enabled: true,
      family: "bitcoin-alkanes",
      role: "public-beta",
    }),
    network: "testnet4",
  },
} as const satisfies Record<
  BetaNetwork,
  { readonly chain: ChainOption; readonly network: WalletNetwork }
>;

export type BetaChain = (typeof betaChains)[keyof typeof betaChains];
