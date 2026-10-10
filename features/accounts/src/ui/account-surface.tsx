import type { UuidV7 } from "@ador/shared/identifiers";
import { AppShell, ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PasskeyPanel } from "./passkey-panel.tsx";

export function AccountSurface({
  actorUserId,
  navigation = [],
  passkeyCredentialIds = [],
  passkeysUnavailable = false,
}: {
  readonly actorUserId: UuidV7;
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
      notices={["◆ SESSION VERIFIED", "▲ PRIVATE ROUTE", "★ SERVER AUTHORITY"]}
    >
      <section className="arcade-section arcade-section--raised">
        <StatusLamp label="Authenticated session" tone="ready" />
        <p className="arcade-eyebrow">Player identity</p>
        <h1>Account console</h1>
        <p>
          Your platform session is active. Wallet connection alone never unlocks
          this surface.
        </p>
        <ArcadePanel eyebrow="Current player" title="Session active">
          <p className="arcade-muted">User {actorUserId}</p>
        </ArcadePanel>
        <PasskeyPanel
          initialCredentialIds={passkeyCredentialIds}
          initialUnavailable={passkeysUnavailable}
        />
      </section>
    </AppShell>
  );
}
