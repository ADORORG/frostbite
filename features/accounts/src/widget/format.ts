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

// A map, and the wallet's own word when there is none: the connection library reports whatever network the wallet is on
// ("testnet", "regtest", …), which is not always one of ours, and the widget must not show "undefined".
const networkNames: ReadonlyMap<string, string> = new Map<
  WalletNetwork,
  string
>([
  ["mainnet", "Mainnet"],
  ["signet", "Signet"],
  ["testnet4", "Testnet4"],
]);
export const networkName = (network: string) =>
  networkNames.get(network) ?? network;
