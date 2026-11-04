import { createAccountsFeature } from "@ador/feature-accounts";
import { createChainStatusFeature } from "@ador/feature-chain-status";
import { createPublicCollectionsFeature } from "@ador/feature-public-collections";
import { createCollectionReviewFeature } from "@ador/feature-collection-review";
import { createCollectionStudioFeature } from "@ador/feature-collection-studio";
import { creatorAdmissionFeature } from "@ador/feature-creator-admission";
import { platformShellFeature } from "@ador/feature-platform-shell";
import { createGameAdminFeature } from "@ador/feature-game-admin";
import { createGamesFeature } from "@ador/feature-games";
import {
  creatorsFeature,
  launchesFeature,
} from "@ador/feature-public-products";
import { createFeatureRegistry } from "@ador/plugin-kit";
import { createUploadsFeature } from "@ador/feature-uploads";
import { authMethods } from "./auth-methods.ts";
import { authorizationPolicy } from "./authorization.ts";
import { balanceSource } from "./balance.ts";
import { chainStatusConfig } from "./chain-status.ts";
import { emailAddressPolicy } from "./email-addresses.ts";
import { emailCodePolicy } from "./email-code.ts";
import { targetChains } from "./chains.ts";
import { gameAdminConfig } from "./game-admin.ts";
import { gameClaimsConfig } from "./game-claims.ts";
import { gameRunsConfig } from "./game-runs.ts";
import { games } from "./games.ts";
import { mailSettings } from "./mail.ts";
import { providerRegistry } from "./providers.ts";
import { setupLinkPolicy } from "./setup-link.ts";
import { gameWalletConfig, walletAuthConfig } from "./wallet.ts";

export const featureRegistry = createFeatureRegistry([
  platformShellFeature,
  createChainStatusFeature(chainStatusConfig),
  createAccountsFeature(
    walletAuthConfig,
    balanceSource,
    authMethods,
    {
      lifetimeMs: setupLinkPolicy.lifetimeMs,
      policyVersion: authorizationPolicy.version,
      requiredMethods: authorizationPolicy.requiredMethods,
    },
    mailSettings === null
      ? null
      : {
          mail: mailSettings,
          maximumAddresses: emailAddressPolicy.maximumPerAccount,
          policy: emailCodePolicy,
        },
  ),
  creatorAdmissionFeature,
  launchesFeature,
  createPublicCollectionsFeature(providerRegistry, targetChains),
  creatorsFeature,
  createGamesFeature(
    games,
    targetChains,
    gameWalletConfig,
    gameRunsConfig,
    gameClaimsConfig,
  ),
  createGameAdminFeature(games, gameAdminConfig),
  createUploadsFeature(providerRegistry),
  createCollectionStudioFeature(providerRegistry, targetChains),
  createCollectionReviewFeature(authorizationPolicy, providerRegistry),
]);
