import type { FeatureEntrypoint } from "@ador/plugin-kit";
import { registerHttpOperation } from "@ador/http/registered-operation";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { createPasskeyOperations } from "./application/passkey-operations.ts";
import { getPasskeyLinkingService } from "./runtime.ts";
import { AccountSurface } from "./ui/account-surface.tsx";

type PasskeyService = ReturnType<typeof getPasskeyLinkingService>;

async function account(
  actorUserId: UuidV7 | null,
  getService: () => PasskeyService,
  navigation: readonly NavigationItem[],
) {
  if (actorUserId === null) return null;
  try {
    return (
      <AccountSurface
        actorUserId={actorUserId}
        navigation={navigation}
        passkeyCredentialIds={await getService().list(actorUserId)}
        surface="account"
      />
    );
  } catch {
    return (
      <AccountSurface
        actorUserId={actorUserId}
        navigation={navigation}
        passkeysUnavailable
        surface="account"
      />
    );
  }
}

export function createAccountsEntrypoint(
  getService: () => PasskeyService = getPasskeyLinkingService,
): FeatureEntrypoint {
  const [list, begin, finish, unlink] = createPasskeyOperations(getService);
  return {
    capabilities: ["api-routes", "authenticated-page", "navigation"],
    id: "accounts",
    operations: [
      registerHttpOperation(list),
      registerHttpOperation(begin),
      registerHttpOperation(finish),
      registerHttpOperation(unlink),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: "/account",
        render: ({ actorUserId, navigation }) =>
          account(actorUserId, getService, navigation),
      },
      {
        access: { capability: "platform:operate", kind: "platform" },
        path: "/admin",
        render: ({ actorUserId, navigation }) =>
          actorUserId === null ? null : (
            <AccountSurface
              actorUserId={actorUserId}
              navigation={navigation}
              surface="admin"
            />
          ),
      },
    ],
    version: "1.0.0",
  };
}
