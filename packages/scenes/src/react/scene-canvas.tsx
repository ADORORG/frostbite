"use client";

import { useEffect, useRef } from "react";

import {
  loopTime,
  sceneHeight,
  sceneWidth,
  stillTime,
  type Scene,
} from "../engine/index.ts";
import { useScenes } from "./scenes-provider.tsx";

// One scene on a canvas. It registers with the page's scheduler, which decides whether it moves; this only draws what it is asked for.
// The canvas is decoration, hidden from screen readers, and the scene is made again if the scene changes.
export function SceneCanvas({
  className,
  fps,
  force,
  scene,
}: {
  readonly className: string;
  readonly fps: number;
  // Runs whenever it is on screen, outside the cap on how many move at once.
  readonly force: boolean;
  readonly scene: Scene;
}) {
  const { scheduler } = useScenes();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const surface = element?.getContext("2d") ?? null;
    if (element === null || surface === null) return;
    const frame = scene.make();
    const draw = (seconds: number) =>
      frame.draw(surface, loopTime(seconds, frame.loopSeconds));
    const registration = scheduler.register({
      distance: () => {
        const box = element.getBoundingClientRect();
        return Math.abs(box.top + box.height / 2 - window.innerHeight / 2);
      },
      drawFrame: draw,
      drawStill: () => draw(stillTime(frame.loopSeconds)),
      fps,
      force,
    });
    if (typeof IntersectionObserver === "undefined") {
      registration.setVisible(true);
      return registration.dispose;
    }
    const watch = new IntersectionObserver(
      (entries) => {
        const latest = entries.at(-1);
        if (latest !== undefined)
          registration.setVisible(latest.isIntersecting);
      },
      { rootMargin: "100px" },
    );
    watch.observe(element);
    return () => {
      watch.disconnect();
      registration.dispose();
    };
  }, [fps, force, scene, scheduler]);
  return (
    <canvas
      aria-hidden="true"
      className={className}
      height={sceneHeight}
      ref={canvas}
      width={sceneWidth}
    />
  );
}
