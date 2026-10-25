import type { FeatureEntrypoint } from "@ador/plugin-kit";
import { registerHttpOperation } from "@ador/http/registered-operation";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { createBalanceOperation } from "./application/balance-operation.ts";
import type { BalanceSource } from "./balance/source.ts";
import { createPasskeySignInOperations } from "./application/passkey-sign-in-operations.ts";
import { createPasskeyOperations } from "./application/passkey-operations.ts";
import { createWalletMethodsOperations } from "./application/wallet-methods-operations.ts";
import { createWalletSignInOperations } from "./application/wallet-sign-in-operations.ts";
import type { WalletAuthServices } from "./application/wallet-services.ts";
import type { WalletNetwork } from "@ador/wallet/contracts";

import type {
  createPasskeyLinkingService,
  PasskeySignInService,
} from "@ador/auth";
import { AccountSurface } from "./ui/account-surface.tsx";
import { AdminHome } from "./ui/admin-home.tsx";
import { SetupPage } from "./ui/setup-page.tsx";
import { SignInPage } from "./ui/sign-in-page.tsx";
import { createRedeemSetupLinkOperation } from "./setup/operation.ts";
import type { SetupLinkService } from "@ador/authorization";

type PasskeyService = ReturnType<typeof createPasskeyLinkingService>;

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
      />
    );
  } catch {
    return (
      <AccountSurface
        actorUserId={actorUserId}
        navigation={navigation}
        passkeysUnavailable
      />
    );
  }
}

export function createAccountsEntrypoint(
  getWalletServices: () => WalletAuthServices,
  balanceSource: BalanceSource | null,
  getSetupLinks: () => SetupLinkService,
  getPasskeySignIn: () => PasskeySignInService,
  getService: () => PasskeyService,
  // What the sign-in page needs of the platform: the kinds of method the deployment offers, and the network a wallet is asked for.
  signIn: {
    readonly network: WalletNetwork;
    readonly offered: () => readonly string[];
  },
): FeatureEntrypoint {
  const [list, begin, finish, unlink] = createPasskeyOperations(getService);
  const [beginPasskeySignIn, finishPasskeySignIn] =
    createPasskeySignInOperations(getPasskeySignIn);
  const [beginSignIn, verifySignIn, signOut] =
    createWalletSignInOperations(getWalletServices);
  const [
    beginLink,
    verifyLink,
    beginStepUp,
    verifyStepUp,
    unlinkWallet,
    listMethods,
  ] = createWalletMethodsOperations(getWalletServices);
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "public-page",
    ],
    id: "accounts",
    operations: [
      registerHttpOperation(list),
      registerHttpOperation(begin),
      registerHttpOperation(finish),
      registerHttpOperation(unlink),
      registerHttpOperation(beginPasskeySignIn),
      registerHttpOperation(finishPasskeySignIn),
      registerHttpOperation(beginSignIn),
      registerHttpOperation(verifySignIn),
      registerHttpOperation(signOut),
      registerHttpOperation(beginLink),
      registerHttpOperation(verifyLink),
      registerHttpOperation(beginStepUp),
      registerHttpOperation(verifyStepUp),
      registerHttpOperation(unlinkWallet),
      registerHttpOperation(listMethods),
      registerHttpOperation(createRedeemSetupLinkOperation(getSetupLinks)),
      registerHttpOperation(
        createBalanceOperation({
          clock: () => new Date(),
          source: balanceSource,
        }),
      ),
    ],
    pages: [
      {
        access: { kind: "public" },
        path: "/sign-in",
        render: ({ navigation }) => (
          <SignInPage
            expectedNetwork={signIn.network}
            navigation={navigation}
            offered={signIn.offered()}
          />
        ),
      },
      {
        access: { kind: "public" },
        path: "/setup",
        render: ({ navigation }) => (
          <SetupPage
            expectedNetwork={signIn.network}
            navigation={navigation}
            offered={signIn.offered()}
          />
        ),
      },
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
          actorUserId === null ? null : <AdminHome navigation={navigation} />,
      },
    ],
    version: "1.0.0",
  };
}
