import { useEffect, useState } from "react";

import { createMintedApi, type MintedApi } from "../client/minted-api.ts";

interface Loaded {
  readonly claimId: string;
  readonly edition: number;
  readonly src: string;
}

// The picture of a minted milestone as an image address, once the platform has it; none while it is being asked for, and none when it
// has no picture to show (a picture is never promised: the page shows nothing rather than a broken image). A picture is only ever
// given for the claim it was loaded for.
export function useMintedPicture(
  claimId: string,
  api?: MintedApi,
): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let current = true;
    (api ?? createMintedApi())
      .picture(claimId)
      .then((answer) => {
        if (current && answer.status === "ok")
          setLoaded({
            claimId,
            edition: answer.edition,
            src: `data:${answer.contentType};base64,${answer.data}`,
          });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [api, claimId]);
  return loaded?.claimId === claimId ? loaded : null;
}
