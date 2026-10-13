import { accountsFeature } from "@ador/feature-accounts";
import { createPublicCollectionsFeature } from "@ador/feature-public-collections";
import { createCollectionReviewFeature } from "@ador/feature-collection-review";
import { createCollectionStudioFeature } from "@ador/feature-collection-studio";
import { creatorAdmissionFeature } from "@ador/feature-creator-admission";
import { platformShellFeature } from "@ador/feature-platform-shell";
import { createGamesFeature } from "@ador/feature-games";
import {
  creatorsFeature,
  launchesFeature,
} from "@ador/feature-public-products";
import { createFeatureRegistry } from "@ador/plugin-kit";
import { createUploadsFeature } from "@ador/feature-uploads";
import { createWalletConnectionFeature } from "@ador/feature-wallet-connection";
import { authorizationPolicy } from "./authorization.ts";
import { targetChains } from "./chains.ts";
import { games } from "./games.ts";
import { providerRegistry } from "./providers.ts";
import { gameWalletConfig, walletConnectionConfig } from "./wallet.ts";

export const featureRegistry = createFeatureRegistry([
  platformShellFeature,
  accountsFeature,
  creatorAdmissionFeature,
  launchesFeature,
  createPublicCollectionsFeature(providerRegistry, targetChains),
  creatorsFeature,
  createGamesFeature(games, targetChains, gameWalletConfig),
  createWalletConnectionFeature(walletConnectionConfig),
  createUploadsFeature(providerRegistry),
  createCollectionStudioFeature(providerRegistry, targetChains),
  createCollectionReviewFeature(authorizationPolicy, providerRegistry),
]);
