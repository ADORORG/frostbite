// Next.js calls `register` once when the server starts. A setting that cannot work stops the server here, with its name, instead of
// failing the first person to need it. Only the Node.js runtime has the chain; the edge runtime is not used for it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkRewardsChainAtStartup } =
    await import("../../../configs/game-rewards");
  await checkRewardsChainAtStartup();
}
