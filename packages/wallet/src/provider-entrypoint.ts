import type { ProviderEntrypoint } from "@frostbite/plugin-kit/providers";

export const laserEyesProviderEntrypoint = {
  capabilities: ["wallet:connect", "wallet:message-sign", "wallet:psbt-sign"],
  id: "lasereyes",
  version: "1.0.0",
} as const satisfies ProviderEntrypoint;
