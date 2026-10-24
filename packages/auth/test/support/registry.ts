import type { DatabaseTransaction } from "@ador/database/connection";

import { createMethodRegistry } from "../../src/methods/registry.ts";
import { passkeyMethod } from "../../src/passkeys/method.ts";
import { walletMethod } from "../../src/wallets/method.ts";

// The registry the deployment builds today: the two methods the platform has.
export const methodRegistry = createMethodRegistry<DatabaseTransaction>([
  walletMethod,
  passkeyMethod,
]);

export const listMethods = methodRegistry.list;
