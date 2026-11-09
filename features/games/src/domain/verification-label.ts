import type { ShareVerification } from "@frostbite/shared/games";

import { shareCopy } from "./share-copy.ts";

// What a shared thing or a minted card says about how it is known: only what is proven. A replayed milestone says so; one the game
// reported says nothing, because "self-reported" told a reader nothing they needed and read as a warning on every share. The level is
// still kept and still decides what can be minted; only the wording shown to people is left out.
export const verificationLabel = (
  verification: ShareVerification | null,
): string | null =>
  verification === "replay-verified" ? shareCopy.verification : null;
