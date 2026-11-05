import type { EmailAddressesView } from "@frostbite/auth";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { WalletNetwork } from "@frostbite/wallet/contracts";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { ConsoleCard, ConsolePage } from "@repo/ui/arcade";

import { EmailPanel } from "./email-panel.tsx";
import { PasskeyPanel } from "./passkey-panel.tsx";
import { WalletPanel } from "./wallet-panel.tsx";

// The signed-in person's account: every way in to it, each in its own card, and the id of the account. What can change here signs the
// other sessions out, and the cards say so only after the server did it.
export function AccountSurface({
  actorUserId,
  emailAddresses = null,
  expectedNetwork,
  navigation = [],
  passkeyCredentialIds = [],
  passkeysUnavailable = false,
}: {
  readonly actorUserId: UuidV7;
  // The account's email addresses and how many it may hold, or null when this deployment has no mail and the card is not shown.
  readonly emailAddresses?: EmailAddressesView | null;
  // The network wallets are asked for; a wallet on another one is flagged.
  readonly expectedNetwork: WalletNetwork;
  readonly navigation?: readonly NavigationItem[];
  readonly passkeyCredentialIds?: readonly string[];
  readonly passkeysUnavailable?: boolean;
}) {
  return (
    <ConsolePage
      avatarSeed={actorUserId}
      eyebrow="Player profile"
      heading="Account"
      intro="Every way you can sign in, and your account's id. Connecting a wallet in the header never signs you in by itself; link it here, or sign in with it."
      navigation={navigation}
      status={{ label: "Signed in", tone: "ready" }}
    >
      <WalletPanel
        expectedNetwork={expectedNetwork}
        otherWays={
          passkeyCredentialIds.length + (emailAddresses?.addresses.length ?? 0)
        }
      />
      <PasskeyPanel
        initialCredentialIds={passkeyCredentialIds}
        initialUnavailable={passkeysUnavailable}
      />
      {emailAddresses === null ? null : <EmailPanel initial={emailAddresses} />}
      <ConsoleCard
        glyph="#"
        lead="The id support asks for. It is not a secret, and it never changes."
        title="Account id"
      >
        <p>
          <code>{actorUserId}</code>
        </p>
      </ConsoleCard>
    </ConsolePage>
  );
}
