import { useEffect, useState } from "react";

import { createMintedApi, type MintedApi } from "../client/minted-api.ts";

// What is known of a minted milestone's picture: still being asked for, the picture as an image address, or none to show (a picture
// is never promised: the page shows a stand-in rather than a broken image).
export type MintedPictureState =
  | { readonly kind: "loading" }
  | { readonly kind: "none" }
  | { readonly edition: number; readonly kind: "ready"; readonly src: string };

interface Answered {
  readonly claimId: string;
  readonly picture: MintedPictureState;
}

// The picture of a minted milestone, once the platform has it. A picture is only ever given for the claim it was loaded for.
export function useMintedPicture(
  claimId: string,
  api?: MintedApi,
): MintedPictureState {
  const [answered, setAnswered] = useState<Answered | null>(null);
  useEffect(() => {
    let current = true;
    const settle = (picture: MintedPictureState) => {
      if (current) setAnswered({ claimId, picture });
    };
    (api ?? createMintedApi())
      .picture(claimId)
      .then((answer) =>
        settle(
          answer.status === "ok"
            ? {
                edition: answer.edition,
                kind: "ready",
                src: `data:${answer.contentType};base64,${answer.data}`,
              }
            : { kind: "none" },
        ),
      )
      .catch(() => settle({ kind: "none" }));
    return () => {
      current = false;
    };
  }, [api, claimId]);
  return answered?.claimId === claimId ? answered.picture : { kind: "loading" };
}
