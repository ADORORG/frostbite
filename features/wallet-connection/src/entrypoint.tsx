import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { WalletConnectionConfig } from "./config.ts";
import { WalletConnectSurface } from "./ui/wallet-connect-surface.tsx";
import { registerHttpOperation } from "@ador/http/registered-operation";
import { createQualificationRuntime } from "./runtime.ts";
import { createQualificationOperations } from "./application/qualification-operations.ts";

export function createWalletConnectionEntrypoint(
  config: WalletConnectionConfig,
): FeatureEntrypoint {
  const [begin, verify] = createQualificationOperations(
    createQualificationRuntime(config),
  );
  return {
    capabilities: ["api-routes", "navigation", "public-page"],
    id: "wallet-connection",
    operations: [registerHttpOperation(begin), registerHttpOperation(verify)],
    pages: [
      {
        access: { kind: "public" },
        path: "/connect",
        render: ({ navigation }) => (
          <WalletConnectSurface config={config} navigation={navigation} />
        ),
      },
    ],
    version: "1.0.0",
  };
}
