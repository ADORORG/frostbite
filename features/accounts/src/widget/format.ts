import { shortenMiddle } from "@repo/ui/arcade";
import type { WalletNetwork } from "@ador/wallet/contracts";

export const abbreviated = (address: string) =>
  address.length <= 18
    ? address
    : `${address.slice(0, 8)}…${address.slice(-8)}`;

// "tb1qrx…pj76": the start and end of an address, for a place with little room (the header's chip). The whole address stays in the
// title and in the menu, to copy.
export const shortAddress = (address: string) => shortenMiddle(address);

const SATOSHIS_PER_BTC = 100_000_000;

// The coin's name on a network. Test networks' coins are worth nothing, so they are written tBTC and never passed off as bitcoin.
export const unitOf = (network: string) =>
  network === "mainnet" ? "BTC" : "tBTC";

// "0.00123456": bitcoin to the satoshi, exact (a balance never exceeds 2.1e15 satoshis, which a number holds without rounding).
export const formatBtc = (satoshis: number) =>
  (satoshis / SATOSHIS_PER_BTC).toFixed(8);

// "0.00123456 tBTC (123,456 sats)": the figure in both units.
export function formatBalance(satoshis: number, network: string): string {
  return `${formatBtc(satoshis)} ${unitOf(network)} (${satoshis.toLocaleString("en-US")} sats)`;
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
