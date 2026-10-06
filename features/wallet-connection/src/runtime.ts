import { createWalletQualificationService } from "@ador/auth/qualification";
import { createDrizzleQualificationRepository } from "@ador/auth/qualification-repository";
import { strictBip322Verifier } from "@ador/auth/bitcoin";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { parseEnvironment } from "@repo/config/env";
import { walletQualificationDefaults } from "@ador/shared/wallet-qualification";
import type { WalletConnectionConfig } from "./config.ts";

export function createQualificationRuntime(config: WalletConnectionConfig) {
  let service: ReturnType<typeof createWalletQualificationService> | undefined;
  return () => {
    if (service) return service;
    const app = parseEnvironment(process.env);
    service = createWalletQualificationService({
      clock: () => new Date(),
      policy: {
        ...(config.qualification ?? walletQualificationDefaults),
        network: config.network,
        origin: new URL(app.PUBLIC_BASE_URL).origin,
        providers: config.candidates.map(({ id }) => id),
      },
      repository: createDrizzleQualificationRepository(
        createDatabaseClient(
          createDatabasePool(parseDatabaseEnvironment(process.env)),
        ),
      ),
      verifier: strictBip322Verifier,
    });
    return service;
  };
}
