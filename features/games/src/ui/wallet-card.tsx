import type { WalletInfo } from "@ador/game-sdk/protocol";
import { ArcadeInfoCard } from "@repo/ui/arcade";

// How many characters of an address stay visible at each end; the rest is elided so it fits the dock.
const addressHead = 8;
const addressTail = 6;
export const shortAddress = (address: string) =>
  address.length <= addressHead + addressTail
    ? address
    : `${address.slice(0, addressHead)}…${address.slice(-addressTail)}`;

// What this game can see of the player's wallet, said as it is: the address and the network, when one is
// connected, and nothing else. Shown only for a game that declared the wallet capability.
export function WalletCard({
  connectHref,
  current,
}: {
  readonly connectHref: string;
  readonly current: WalletInfo | null;
}) {
  return (
    <ArcadeInfoCard title="Your wallet">
      {current === null ? (
        <>
          <p>No wallet is connected.</p>
          <p>
            This game can see your wallet&apos;s address once you connect one.{" "}
            <a href={connectHref}>Connect a wallet</a>, then come back.
          </p>
        </>
      ) : (
        <>
          <p>
            <span title={current.address}>{shortAddress(current.address)}</span>{" "}
            on {current.network}
          </p>
          <p>
            This game can see this address. It cannot see anything else in your
            wallet, sign for you or move anything.
          </p>
        </>
      )}
    </ArcadeInfoCard>
  );
}
