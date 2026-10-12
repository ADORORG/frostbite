"use client";

import { useState, useSyncExternalStore } from "react";

const reducedMotion = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(reducedMotion);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Whether the person asked for less motion. The server and the first paint say yes, so a clip never starts
// before the browser has said it may.
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia(reducedMotion).matches,
    () => true,
  );
}

// The picture that stands for something in a catalog: a still, and over it a short silent clip when there is
// one and motion is welcome. With no picture a stand-in is drawn from the name, so a row is never blank. The clip
// is decoration (the picture's text says what it shows), so a clip that cannot play simply leaves the still.
export function ArcadePreview({
  alt,
  image,
  name,
  video,
}: {
  readonly alt: string;
  readonly image: string | null;
  readonly name: string;
  readonly video: string | null;
}) {
  const reduced = usePrefersReducedMotion();
  const [clipFailed, setClipFailed] = useState(false);
  const playing = video !== null && !reduced && !clipFailed;
  return (
    <div className="arcade-preview" data-playing={playing}>
      {image === null ? (
        <div aria-hidden="true" className="arcade-preview__stand-in">
          {name.slice(0, 1)}
        </div>
      ) : (
        <img alt={alt} decoding="async" loading="lazy" src={image} />
      )}
      {playing ? (
        <video
          aria-hidden="true"
          autoPlay
          loop
          muted
          onError={() => setClipFailed(true)}
          playsInline
          poster={image ?? undefined}
          preload="metadata"
          src={video}
        />
      ) : null}
      <span aria-hidden="true" className="arcade-preview__scan" />
    </div>
  );
}
