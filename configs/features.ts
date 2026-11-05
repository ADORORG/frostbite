import { createAccountsFeature } from "@frostbite/feature-accounts";
import { createChainStatusFeature } from "@frostbite/feature-chain-status";
import { createPublicCollectionsFeature } from "@frostbite/feature-public-collections";
import { createCollectionReviewFeature } from "@frostbite/feature-collection-review";
import { createCollectionStudioFeature } from "@frostbite/feature-collection-studio";
import { creatorAdmissionFeature } from "@frostbite/feature-creator-admission";
import { platformShellFeature } from "@frostbite/feature-platform-shell";
import { createGameAdminFeature } from "@frostbite/feature-game-admin";
import { createGamesFeature } from "@frostbite/feature-games";
import {
  creatorsFeature,
  launchesFeature,
} from "@frostbite/feature-public-products";
import { createFeatureRegistry } from "@frostbite/plugin-kit";
import { createUploadsFeature } from "@frostbite/feature-uploads";
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
      : { mail: mailSettings, policy: emailCodePolicy },
    emailAddressPolicy.maximumPerAccount,
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
