import type { UuidV7 } from "@ador/shared/identifiers";
import { AppShell, ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PasskeyPanel } from "./passkey-panel.tsx";

const surfaces = {
  account: {
    eyebrow: "Player identity",
    status: "Authenticated session",
    title: "Account console",
    body: "Your platform session is active. Wallet connection alone never unlocks this surface.",
  },
  admin: {
    eyebrow: "Platform operations",
    status: "Staff capability verified",
    title: "Admin console",
    body: "Platform operations are available to an active staff assignment. Creator admission reviews are separated from broader platform authority.",
  },
} as const;

export function AccountSurface({
  actorUserId,
  navigation = [],
  passkeyCredentialIds = [],
  passkeysUnavailable = false,
  surface,
}: {
  readonly actorUserId: UuidV7;
  readonly navigation?: readonly NavigationItem[];
  readonly passkeyCredentialIds?: readonly string[];
  readonly passkeysUnavailable?: boolean;
  readonly surface: keyof typeof surfaces;
}) {
  const content = surfaces[surface];
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Authenticated beta workspace"
      homeHref="/"
      navigation={navigation}
      notices={["◆ SESSION VERIFIED", "▲ PRIVATE ROUTE", "★ SERVER AUTHORITY"]}
    >
      <section className="arcade-section arcade-section--raised">
        <StatusLamp label={content.status} tone="ready" />
        <p className="arcade-eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        <ArcadePanel eyebrow="Current player" title="Session active">
          <p className="arcade-muted">User {actorUserId}</p>
        </ArcadePanel>
        {surface === "account" ? (
          <PasskeyPanel
            initialCredentialIds={passkeyCredentialIds}
            initialUnavailable={passkeysUnavailable}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
