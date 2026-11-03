import { probeFeeSource, type FeeSourceSettings } from "@ador/chain/configured";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

// What the platform looks at when it starts: the chosen fee explorer, once. Without a fallback rate an explorer that cannot be read stops the
// server there, saying which setting, instead of failing someone's first step. With one, a step is still priced, so the server starts and
// the rate is used (and said so) whenever the explorer fails.
export async function feeSourceStartupCheck(
  environment: RewardsChainEnvironment,
  feeApi: FeeSourceSettings,
): Promise<void> {
  const { feeSource } = environment;
  if (feeSource.fallbackSatPerVb !== null) return;
  try {
    await probeFeeSource(feeApi);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `REWARDS_FEE_API_FORMAT (${feeSource.adapter}) is not usable: ${reason} Choose another, or set REWARDS_FEE_RATE_SAT_VB as a fallback.`,
      { cause: error },
    );
  }
}
