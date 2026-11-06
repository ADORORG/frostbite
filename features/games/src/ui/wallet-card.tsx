import type { WalletInfo } from "@frostbite/game-sdk/protocol";
import type { WalletNetwork } from "@frostbite/wallet/contracts";
import { ArcadeInfoCard, shortenMiddle } from "@repo/ui/arcade";

// What this game can see of the player's wallet, said as it is: the address and the network, when one is
// connected, and nothing else. Shown only for a game that declared the wallet capability.
// The protocol names the network as plain text; the ones the platform knows are written as words.
// A map, not an object: the name comes from the game's side of the protocol, and "constructor" must not find a function.
const networkNames: ReadonlyMap<string, string> = new Map([
  ["mainnet", "Mainnet"],
  ["signet", "Signet"],
  ["testnet4", "Testnet4"],
]);
const networkName = (network: string) => networkNames.get(network) ?? network;

export function WalletCard({
  connect,
  current,
  expectedNetwork,
}: {
  readonly connect: () => void;
  readonly current: WalletInfo | null;
  readonly expectedNetwork: WalletNetwork;
}) {
  return (
    <ArcadeInfoCard title="Your wallet">
      {current === null ? (
        <>
          <p>No wallet is connected.</p>
          <p>
            This game can see your wallet&apos;s address once you connect one.
          </p>
          <button
            className="arcade-button arcade-button--cyan"
            onClick={connect}
            type="button"
          >
            Connect a wallet
          </button>
        </>
      ) : (
        <>
          <p>
            <span title={current.address}>
              {shortenMiddle(current.address)}
            </span>{" "}
            on {current.network}
          </p>
          {current.network === expectedNetwork ? null : (
            <p role="status">
              {`⚠ ${networkName(current.network)} — this game uses ${networkName(expectedNetwork)}`}
            </p>
          )}
          <p>
            This game can see this address. It cannot see anything else in your
            wallet, sign for you or move anything.
          </p>
        </>
      )}
    </ArcadeInfoCard>
  );
}
