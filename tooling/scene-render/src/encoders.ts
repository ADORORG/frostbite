import { sceneHeight, sceneWidth } from "@ador/scenes/engine";
import { videoSpec } from "@ador/scenes/video";

// One output of the renderer: how to turn the stream of raw frames into a file. Each is one `ffmpeg` command line, built here as data so
// a test can read it and the runner needs no knowledge of codecs.
export interface Encoder {
  readonly extension: "mp4" | "png" | "webm";
  readonly args: readonly string[];
  // How many frames it takes from the stream (all of them, or the one that is the still).
  readonly frames: "all" | "still";
}

const input = [
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgba",
  "-s",
  `${String(sceneWidth)}x${String(sceneHeight)}`,
  "-r",
  String(videoSpec.fps),
  "-i",
  "-",
] as const;

// Whole-number enlargement with no smoothing, so the pixels stay square and crisp.
const enlarge = `scale=${String(sceneWidth * videoSpec.scale)}:${String(sceneHeight * videoSpec.scale)}:flags=neighbor`;

// A scene has no sound, so no track is written. Quality is set for flat colour at a small size: a loop is tens of kilobytes.
export const encoders: readonly Encoder[] = [
  {
    args: [
      "-vf",
      `${enlarge},format=yuv420p`,
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      "36",
      "-row-mt",
      "1",
      "-an",
    ],
    extension: "webm",
    frames: "all",
  },
  {
    args: [
      "-vf",
      `${enlarge},format=yuv420p`,
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "slow",
      "-movflags",
      "+faststart",
      "-an",
    ],
    extension: "mp4",
    frames: "all",
  },
  {
    args: ["-vf", enlarge, "-frames:v", "1"],
    extension: "png",
    frames: "still",
  },
];

// The whole command line for one output file. `-y` replaces a file from an earlier run, so a render can be repeated.
export function commandFor(encoder: Encoder, file: string): readonly string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...input,
    ...encoder.args,
    file,
  ];
}
