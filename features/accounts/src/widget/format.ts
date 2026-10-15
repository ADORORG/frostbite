import type { WalletNetwork } from "@ador/wallet/contracts";

export const abbreviated = (address: string) =>
  address.length <= 18
    ? address
    : `${address.slice(0, 8)}…${address.slice(-8)}`;

const SATOSHIS_PER_BTC = 100_000_000;

// "0.00123456 BTC (123,456 sats)": the figure in both units, exact (a balance never exceeds 2.1e15 satoshis, which
// a number holds without rounding).
export function formatBalance(satoshis: number): string {
  const btc = (satoshis / SATOSHIS_PER_BTC).toFixed(8);
  return `${btc} BTC (${satoshis.toLocaleString("en-US")} sats)`;
}

// The time of an ISO timestamp, in UTC, so the same reading reads the same everywhere.
export const updatedAt = (iso: string) => `${iso.slice(11, 19)} UTC`;

const networkNames: Record<WalletNetwork, string> = {
  mainnet: "Mainnet",
  signet: "Signet",
};
export const networkName = (network: WalletNetwork) => networkNames[network];
