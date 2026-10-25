import { parseEnv } from "node:util";

// The manual stack is disposable and local, but the rewards chain it can be pointed at is not: it is the node, the network and the
// key a developer keeps in the app's own settings file. These are the only settings taken from that file, so the stack still never
// reaches real storage, a real database or a real mail or auth service by accident.
const chainSettingKeys = (key: string) =>
  key === "BETA_NETWORK" || key.startsWith("REWARDS_");

// The chain settings in the text of a settings file. A setting already in the shell wins over the file, as everywhere else; a blank
// one is left out, since blank means "not set".
export function chainSettingsFrom(
  fileText: string | null,
  shell: NodeJS.ProcessEnv,
): Record<string, string> {
  if (fileText === null) return {};
  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(parseEnv(fileText))) {
    if (!chainSettingKeys(key) || key in shell) continue;
    if (value !== undefined && value.trim() !== "") settings[key] = value;
  }
  return settings;
}

// What the stack says about the chain, in words and without any key: which network, which node host, or that there is none.
export function describeChain(environment: NodeJS.ProcessEnv): string {
  const url = environment.REWARDS_CHAIN_RPC_URL?.trim() ?? "";
  if (url === "") {
    return 'No rewards chain is configured (REWARDS_CHAIN_RPC_URL is blank): claims and game administration say "not available".';
  }
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    host = "an address that is not a URL";
  }
  const network = environment.BETA_NETWORK?.trim() || "signet";
  return `Rewards chain: ${network}, through ${host}. ${describeFeeSource(environment)} Staff steps sent from here are real transactions on that network.`;
}

// Where the fee levels come from, said plainly: a fixed rate is the operator's number and is not live, and the page must not be
// mistaken for the network's own recommendation.
function describeFeeSource(environment: NodeJS.ProcessEnv): string {
  const rate = environment.REWARDS_FEE_RATE_SAT_VB?.trim() ?? "";
  const url = environment.REWARDS_FEE_API_URL?.trim() ?? "";
  if (rate !== "" && url !== "")
    return "Both REWARDS_FEE_RATE_SAT_VB and REWARDS_FEE_API_URL are set; they are alternatives and the web server will refuse to start until one is blank.";
  if (rate !== "")
    return `Fee rate: FIXED at ${rate} sat/vB by REWARDS_FEE_RATE_SAT_VB (not live).`;
  if (url !== "") {
    try {
      return `Fee levels from ${new URL(url).host} (REWARDS_FEE_API_URL).`;
    } catch {
      return "Fee levels from an address that is not a URL (REWARDS_FEE_API_URL).";
    }
  }
  return "Fee levels from the network's default explorer.";
}
