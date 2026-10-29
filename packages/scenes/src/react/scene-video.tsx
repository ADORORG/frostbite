"use client";

import { useEffect, useRef, useState } from "react";

import type { Scene } from "../engine/index.ts";
import { videoFiles } from "../video/index.ts";
import { useScenes } from "./provider.tsx";

// A scene played from its video, for a browser that cannot draw it. It plays only while on screen, shows the still frame while scenes
// are not moving (or until the video has loaded), and shows nothing at all if even the still cannot be fetched: never a broken-image box.
function Video({
  base,
  className,
  moving,
  scene,
}: {
  readonly base: string;
  readonly className: string;
  readonly moving: boolean;
  readonly scene: Scene;
}) {
  const files = videoFiles(scene.id);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const clip = useRef<HTMLVideoElement>(null);
  const playing = moving && !videoFailed;
  useEffect(() => {
    const element = clip.current;
    if (element === null || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true)
          void element.play().catch(() => undefined);
        else element.pause();
      },
      { rootMargin: "100px" },
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, [playing]);
  const poster = `${base}/${files.poster}`;
  if (playing)
    return (
      <video
        aria-hidden="true"
        autoPlay
        className={className}
        loop
        muted
        onError={() => setVideoFailed(true)}
        playsInline
        poster={poster}
        preload="metadata"
        ref={clip}
        tabIndex={-1}
      >
        <source src={`${base}/${files.webm}`} type="video/webm" />
        <source src={`${base}/${files.mp4}`} type="video/mp4" />
      </video>
    );
  if (posterFailed) return null;
  return (
    // The picture is decoration, like the scene it stands for.
    <img
      alt=""
      aria-hidden="true"
      className={className}
      onError={() => setPosterFailed(true)}
      src={poster}
    />
  );
}

export function SceneVideo(props: {
  readonly className: string;
  readonly scene: Scene;
}) {
  const { playback, videoBase } = useScenes();
  if (videoBase === null) return null;
  // Keyed by scene, so a change of scene starts clean instead of inheriting the last one's failure.
  return (
    <Video
      base={videoBase}
      className={props.className}
      key={props.scene.id}
      moving={playback === "play"}
      scene={props.scene}
    />
  );
}
