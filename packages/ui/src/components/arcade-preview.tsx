"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { standInInitials, standInTone } from "./stand-in.ts";

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

// Whether the box is on screen. A clip plays only while it is, so a wall of them does not run every video at once, and a clip that
// has scrolled away stops costing anything. Where the browser cannot tell, it is taken to be.
function useOnScreen(box: RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const node = box.current;
    if (node === null || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting === true),
      { threshold: 0.2 },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [box]);
  return onScreen;
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
  const box = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(box);
  const playing = video !== null && !reduced && !clipFailed && onScreen;
  return (
    <div className="arcade-preview" data-playing={playing} ref={box}>
      {image === null ? (
        <div
          aria-hidden="true"
          className={`arcade-preview__stand-in arcade-preview__stand-in--${String(standInTone(name))}`}
        >
          {standInInitials(name)}
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
