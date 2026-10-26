import type { FeeApiFormat } from "@ador/shared/chain";

import { createEsploraFeeSource, esploraProbeTargets } from "./esplora.ts";
import { createMempoolFeeSource, mempoolProbeTargets } from "./mempool.ts";
import type { FeeAdapter } from "./types.ts";

// The one place fee explorers are known (the hosted nodes' own fee estimates follow a few outlying transactions and are not used, finding S106), keyed by `feeApiFormats` (`@ador/shared/chain`) so the compiler refuses to build until a name has
// its adapter. To support another explorer: its parser beside these, its name in `feeApiFormats`, and an entry here with its address for
// each network (the address up to the network, without the path).
export const feeAdapters: Readonly<Record<FeeApiFormat, FeeAdapter>> = {
  blockstream: {
    create: createEsploraFeeSource,
    links: {
      signet: "https://blockstream.info/signet",
      testnet4: "https://blockstream.info/testnet4",
    },
    probeTargets: esploraProbeTargets,
  },
  mempool: {
    create: createMempoolFeeSource,
    links: {
      signet: "https://mempool.space/signet",
      testnet4: "https://mempool.space/testnet4",
    },
    probeTargets: mempoolProbeTargets,
  },
};
