import { accountsFeature } from "@ador/feature-accounts";
import { createCollectionStudioFeature } from "@ador/feature-collection-studio";
import { creatorAdmissionFeature } from "@ador/feature-creator-admission";
import { platformShellFeature } from "@ador/feature-platform-shell";
import {
  collectionsFeature,
  creatorsFeature,
  gamesFeature,
  launchesFeature,
} from "@ador/feature-public-products";
import { createFeatureRegistry } from "@ador/plugin-kit";
import { createUploadsFeature } from "@ador/feature-uploads";
import { createWalletConnectionFeature } from "@ador/feature-wallet-connection";
import { targetChains } from "./chains.ts";
import { providerRegistry } from "./providers.ts";
import { walletConnectionConfig } from "./wallet.ts";

export const featureRegistry = createFeatureRegistry([
  platformShellFeature,
  accountsFeature,
  creatorAdmissionFeature,
  launchesFeature,
  collectionsFeature,
  creatorsFeature,
  gamesFeature,
  createWalletConnectionFeature(walletConnectionConfig),
  createUploadsFeature(providerRegistry),
  createCollectionStudioFeature(providerRegistry, targetChains),
]);
