import {
  laserEyesProviderIds,
  type LaserEyesProviderId,
} from "@ador/wallet/conformance";
import type { WalletNetwork } from "@ador/wallet/contracts";
import {
  walletQualificationDefaults,
  walletQualificationMaximumAttemptsLimit,
} from "@ador/shared/wallet-qualification";

export interface WalletCandidate {
  readonly id: LaserEyesProviderId;
  readonly label: string;
}

export interface WalletConnectionConfig {
  readonly candidates: readonly WalletCandidate[];
  readonly network: WalletNetwork;
  readonly qualification?: Readonly<{
    lifetimeMs: number;
    maximumAttempts: number;
  }>;
}

export function validateWalletConnectionConfig(
  config: WalletConnectionConfig,
): WalletConnectionConfig {
  const qualification = config.qualification ?? walletQualificationDefaults;
  if (
    !Number.isSafeInteger(qualification.lifetimeMs) ||
    qualification.lifetimeMs <= 0 ||
    !Number.isSafeInteger(qualification.maximumAttempts) ||
    qualification.maximumAttempts <= 0 ||
    qualification.maximumAttempts > walletQualificationMaximumAttemptsLimit
  ) {
    throw new Error("Invalid wallet qualification limits.");
  }
  if (config.candidates.length === 0) {
    throw new Error("At least one wallet qualification candidate is required.");
  }
  const supported = new Set<LaserEyesProviderId>(laserEyesProviderIds);
  const ids = new Set<LaserEyesProviderId>();
  for (const candidate of config.candidates) {
    if (!supported.has(candidate.id)) {
      throw new Error(`Unsupported LaserEyes provider: ${candidate.id}.`);
    }
    if (candidate.label.trim().length === 0) {
      throw new Error(`${candidate.id} requires a display label.`);
    }
    if (ids.has(candidate.id)) {
      throw new Error(`${candidate.id} is configured more than once.`);
    }
    ids.add(candidate.id);
  }
  return Object.freeze({
    candidates: Object.freeze(
      config.candidates.map((candidate) => Object.freeze({ ...candidate })),
    ),
    network: config.network,
    qualification: Object.freeze({ ...qualification }),
  });
}
