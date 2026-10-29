"use client";

import { sceneCopy } from "./copy.ts";
import { useScenes } from "./scenes-provider.tsx";

// The switch for animation, always on the page: anything that moves for more than a few seconds must be stoppable. It says what is true
// now (moving or not, whatever the reason), and the person's choice is remembered.
export function AnimationToggle() {
  const { playback, setChoice } = useScenes();
  const moving = playback === "play";
  return (
    <button
      aria-label={sceneCopy.switchLabel}
      aria-pressed={moving}
      className="arcade-button arcade-button--cyan"
      onClick={() => setChoice(moving ? "off" : "on")}
      type="button"
    >
      {moving ? sceneCopy.switchOn : sceneCopy.switchOff}
    </button>
  );
}
