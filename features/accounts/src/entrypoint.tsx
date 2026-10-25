import type { FeatureEntrypoint } from "@ador/plugin-kit";
import { registerHttpOperation } from "@ador/http/registered-operation";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { createBalanceOperation } from "./application/balance-operation.ts";
import type { BalanceSource } from "./balance/source.ts";
import { createEmailLinkOperations } from "./application/email-link-operations.ts";
import { createEmailSignInOperations } from "./application/email-sign-in-operations.ts";
import { createPasskeySignInOperations } from "./application/passkey-sign-in-operations.ts";
import { createPasskeyOperations } from "./application/passkey-operations.ts";
import { createWalletMethodsOperations } from "./application/wallet-methods-operations.ts";
import { createWalletSignInOperations } from "./application/wallet-sign-in-operations.ts";
import type { WalletAuthServices } from "./application/wallet-services.ts";
import type { WalletNetwork } from "@ador/wallet/contracts";

import { emailMethodKind } from "@ador/auth";
import type {
  ContactCodeService,
  ContactLinkService,
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
  getEmailLinks: () => ContactLinkService,
  emailOffered: boolean,
  navigation: readonly NavigationItem[],
) {
  if (actorUserId === null) return null;
  // The email addresses are shown only where mail is set up; a failure to read them hides the panel rather than showing a list
  // that was not read.
  const emailAddresses = emailOffered
    ? await getEmailLinks()
        .list(actorUserId, emailMethodKind)
        .catch(() => null)
    : null;
  try {
    return (
      <AccountSurface
        actorUserId={actorUserId}
        emailAddresses={emailAddresses}
        navigation={navigation}
        passkeyCredentialIds={await getService().list(actorUserId)}
      />
    );
  } catch {
    return (
      <AccountSurface
        actorUserId={actorUserId}
        emailAddresses={emailAddresses}
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
  getEmailSignIn: () => ContactCodeService,
  getEmailLinks: () => ContactLinkService,
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
  const [requestEmailCode, verifyEmailCode] =
    createEmailSignInOperations(getEmailSignIn);
  const [listAddresses, requestLinkCode, verifyLinkCode, unlinkAddress] =
    createEmailLinkOperations(getEmailLinks);
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
      registerHttpOperation(requestEmailCode),
      registerHttpOperation(verifyEmailCode),
      registerHttpOperation(listAddresses),
      registerHttpOperation(requestLinkCode),
      registerHttpOperation(verifyLinkCode),
      registerHttpOperation(unlinkAddress),
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
          account(
            actorUserId,
            getService,
            getEmailLinks,
            signIn.offered().includes(emailMethodKind),
            navigation,
          ),
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
