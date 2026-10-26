import type { UuidV7 } from "@ador/shared/identifiers";
import type { WalletNetwork } from "@ador/wallet/contracts";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame, SectionBlock } from "@repo/ui/arcade";

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
  // The account's email addresses, or null when this deployment has no mail and the card is not shown.
  readonly emailAddresses?: readonly string[] | null;
  // The network wallets are asked for; a wallet on another one is flagged.
  readonly expectedNetwork: WalletNetwork;
  readonly navigation?: readonly NavigationItem[];
  readonly passkeyCredentialIds?: readonly string[];
  readonly passkeysUnavailable?: boolean;
}) {
  return (
    <PageFrame
      eyebrow="Account"
      footerLabel="Account"
      heading="Account"
      intro="Every way you can sign in. Connecting a wallet in the header never signs you in by itself."
      navigation={navigation}
    >
      <WalletPanel
        expectedNetwork={expectedNetwork}
        otherWays={passkeyCredentialIds.length + (emailAddresses?.length ?? 0)}
      />
      <PasskeyPanel
        initialCredentialIds={passkeyCredentialIds}
        initialUnavailable={passkeysUnavailable}
      />
      {emailAddresses === null ? null : (
        <EmailPanel initialAddresses={emailAddresses} />
      )}
      <SectionBlock
        description="The id support asks for. It is not a secret, and it never changes."
        title="Account id"
      >
        <p>
          <code>{actorUserId}</code>
        </p>
      </SectionBlock>
    </PageFrame>
  );
}
