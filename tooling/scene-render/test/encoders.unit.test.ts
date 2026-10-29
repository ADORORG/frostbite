import { describe, expect, it } from "vitest";

import { commandFor, encoders } from "../src/encoders.ts";

const lineFor = (extension: string) => {
  const encoder = encoders.find(
    (candidate) => candidate.extension === extension,
  );
  if (encoder === undefined) throw new Error(`No ${extension} encoder.`);
  return commandFor(encoder, `out.${extension}`);
};
const after = (line: readonly string[], flag: string) =>
  line[line.indexOf(flag) + 1];

describe("what is rendered", () => {
  it("is a web video, a phone-friendly video and a still, in that order of preference", () => {
    expect(encoders.map(({ extension }) => extension)).toEqual([
      "webm",
      "mp4",
      "png",
    ]);
    expect(encoders.map(({ frames }) => frames)).toEqual([
      "all",
      "all",
      "still",
    ]);
  });

  it("reads raw frames of the scene's own size at the video's own rate from the input", () => {
    const line = lineFor("webm");
    expect(after(line, "-f")).toBe("rawvideo");
    expect(after(line, "-s")).toBe("160x90");
    expect(after(line, "-r")).toBe("30");
    expect(after(line, "-i")).toBe("-");
  });

  it("enlarges by a whole number with no smoothing, so pixels stay square", () => {
    for (const extension of ["webm", "mp4", "png"])
      expect(after(lineFor(extension), "-vf")).toContain(
        "scale=640:360:flags=neighbor",
      );
  });

  it("makes videos any browser can play: 4:2:0 colour, no sound, and the mp4 ready to start before it has all arrived", () => {
    for (const extension of ["webm", "mp4"]) {
      const line = lineFor(extension);
      expect(after(line, "-vf")).toContain("format=yuv420p");
      expect(line).toContain("-an");
    }
    expect(after(lineFor("webm"), "-c:v")).toBe("libvpx-vp9");
    expect(after(lineFor("mp4"), "-c:v")).toBe("libx264");
    expect(after(lineFor("mp4"), "-movflags")).toBe("+faststart");
  });

  it("makes the still from one frame, replaces an old file, and names its output last", () => {
    const line = lineFor("png");
    expect(after(line, "-frames:v")).toBe("1");
    expect(line).toContain("-y");
    expect(line.at(-1)).toBe("out.png");
  });
});
