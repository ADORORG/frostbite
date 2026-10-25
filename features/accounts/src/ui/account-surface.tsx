import type { UuidV7 } from "@ador/shared/identifiers";
import { AppShell, ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { EmailPanel } from "./email-panel.tsx";
import { PasskeyPanel } from "./passkey-panel.tsx";

export function AccountSurface({
  actorUserId,
  emailAddresses = null,
  navigation = [],
  passkeyCredentialIds = [],
  passkeysUnavailable = false,
}: {
  readonly actorUserId: UuidV7;
  // The account's email addresses, or null when this deployment has no mail and the panel is not shown.
  readonly emailAddresses?: readonly string[] | null;
  readonly navigation?: readonly NavigationItem[];
  readonly passkeyCredentialIds?: readonly string[];
  readonly passkeysUnavailable?: boolean;
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Authenticated beta workspace"
      homeHref="/"
      navigation={navigation}
    >
      <section className="arcade-section arcade-section--raised">
        <StatusLamp label="Authenticated session" tone="ready" />
        <p className="arcade-eyebrow">Player identity</p>
        <h1>Account console</h1>
        <p>
          Your platform session is active. Wallet connection alone never unlocks
          this surface. Sign in and manage your wallets from the wallet button
          in the header.
        </p>
        <ArcadePanel eyebrow="Current player" title="Session active">
          <p className="arcade-muted">User {actorUserId}</p>
        </ArcadePanel>
        <PasskeyPanel
          initialCredentialIds={passkeyCredentialIds}
          initialUnavailable={passkeysUnavailable}
        />
        {emailAddresses === null ? null : (
          <EmailPanel initialAddresses={emailAddresses} />
        )}
      </section>
    </AppShell>
  );
}
