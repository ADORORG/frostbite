// What a scene's video is, in one place: the renderer makes it this way and the page asks for it by these names.
export const videoSpec = {
  // Frames a second. A scene is drawn at 30 for a backdrop, and the video matches.
  fps: 30,
  // The 160 x 90 grid is enlarged by this whole number with no smoothing, so the pixels stay square and crisp.
  scale: 4,
} as const;

export interface VideoFiles {
  readonly mp4: string;
  readonly poster: string;
  readonly webm: string;
}

// The files that make up one scene's video, relative to wherever the app serves them. The id is a scene's own, never a user's.
export function videoFiles(sceneId: string): VideoFiles {
  return {
    mp4: `${sceneId}.mp4`,
    poster: `${sceneId}.png`,
    webm: `${sceneId}.webm`,
  };
}

// The frames that make one loop, and when each is drawn. The count is rounded to a whole number and the moments spread evenly over the
// loop, so the last frame is one step before the first and the video closes without a jump even for a loop that is not a whole number
// of frames long.
export function framePlan(loopSeconds: number): readonly number[] {
  const count = Math.max(1, Math.round(loopSeconds * videoSpec.fps));
  return Array.from({ length: count }, (_, at) => (at * loopSeconds) / count);
}
