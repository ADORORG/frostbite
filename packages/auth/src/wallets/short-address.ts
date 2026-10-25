const KEPT_AT_START = 6;
const KEPT_AT_END = 4;

// An address short enough to read in a list and long enough to recognise, the way the wallet widget shows it.
export function shortenAddress(address: string): string {
  return address.length <= KEPT_AT_START + KEPT_AT_END + 1
    ? address
    : `${address.slice(0, KEPT_AT_START)}…${address.slice(-KEPT_AT_END)}`;
}
