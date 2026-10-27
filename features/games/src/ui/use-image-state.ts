import { useState } from "react";

// Whether an image has come: still being fetched, shown, or not to be had (the address answered with an error, or with something that is
// not a picture). The browser says which, through the image's own events; a state belongs to the address it was told about, so a
// picture that failed is never taken for the next one's.
export type ImageState = "loading" | "none" | "ready";

export function useImageState(src: string): {
  readonly onError: () => void;
  readonly onLoad: () => void;
  readonly state: ImageState;
} {
  const [told, setTold] = useState<{
    readonly src: string;
    readonly state: "none" | "ready";
  } | null>(null);
  return {
    onError: () => setTold({ src, state: "none" }),
    onLoad: () => setTold({ src, state: "ready" }),
    state: told?.src === src ? told.state : "loading",
  };
}
