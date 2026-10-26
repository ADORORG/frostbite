import { probeFeeSource, type FeeSourceSettings } from "@ador/chain/configured";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

// What the platform looks at when it starts. Only an explorer the operator named is looked at (the network's own default is what
// every deployment has had, and a fixed rate has nothing to ask); a wrong address or an answer that is not an explorer's stops the
// server there, saying which setting, instead of failing someone's first step.
export async function feeSourceStartupCheck(
  environment: RewardsChainEnvironment,
  feeApi: FeeSourceSettings,
): Promise<void> {
  const { feeSource } = environment;
  if (feeSource.kind !== "explorer") return;
  try {
    await probeFeeSource(feeApi);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `REWARDS_FEE_API_URL (${new URL(feeSource.url).host}, read as ${feeSource.format}) is not usable: ${reason}`,
    );
  }
}
