import { z } from "zod";

// The Bitcoin networks the platform knows. A network is a family of chains that share address encoding and consensus rules; which
// chain of it a deployment uses is `configs/chains.ts`. Signet and testnet4 are different chains whose addresses are written alike
// (bech32 prefix `tb`), so an address alone cannot tell them apart.
export const bitcoinNetworks = [
  "mainnet",
  "signet",
  "testnet4",
  "regtest",
] as const;
export type BitcoinNetwork = (typeof bitcoinNetworks)[number];

// The networks a person's wallet can be on and sign in from. Regtest is a developer's own chain: no wallet is connected to it.
export const walletNetworks = ["mainnet", "signet", "testnet4"] as const;
export const walletNetworkSchema = z.enum(walletNetworks);
export type WalletNetwork = z.infer<typeof walletNetworkSchema>;

export function isWalletNetwork(value: string): value is WalletNetwork {
  return walletNetworkSchema.safeParse(value).success;
}
