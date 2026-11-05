import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Scene } from "@frostbite/scenes/engine";
import { videoFiles, videoSpec } from "@frostbite/scenes/video";
import { afterEach, describe, expect, it } from "vitest";

import { runEncoder } from "../src/encode.ts";
import { renderScene } from "../src/render.ts";

// A loop of two seconds that is a different colour each half second, so the frames can be told apart in the file.
const colours = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"] as const;
const test: Scene = {
  id: "test-scene",
  make: () => ({
    draw: (surface, t) => {
      surface.fillStyle =
        colours[Math.floor(t * 2) % colours.length] ?? "#000000";
      surface.fillRect(0, 0, 160, 90);
    },
    loopSeconds: 2,
  }),
  name: "Test",
};

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { force: true, recursive: true })),
  );
});
const folder = async () => {
  const made = await mkdtemp(join(tmpdir(), "scene-render-"));
  folders.push(made);
  return made;
};
const probe = (file: string, entries: string, stream = true) =>
  execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      ...(stream ? ["-select_streams", "v:0"] : []),
      "-show_entries",
      entries,
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8" },
  ).trim();

describe("rendering a scene with the real encoder", () => {
  it("writes the three files the page asks for, and nothing else", async () => {
    const directory = await folder();
    const written = await renderScene(test, directory);
    const names = videoFiles(test.id);
    expect((await readdir(directory)).sort()).toEqual(
      [names.mp4, names.poster, names.webm].sort(),
    );
    expect(written.map((file) => file.split("/").at(-1))).toEqual([
      names.webm,
      names.mp4,
      names.poster,
    ]);
  });

  it("makes videos of the right size, codec and length: exactly one loop", async () => {
    const directory = await folder();
    await renderScene(test, directory);
    const names = videoFiles(test.id);
    const expectedFrames = 2 * videoSpec.fps;
    expect(
      probe(join(directory, names.webm), "stream=codec_name,width,height"),
    ).toBe("vp9,640,360");
    expect(
      probe(join(directory, names.mp4), "stream=codec_name,width,height"),
    ).toBe("h264,640,360");
    for (const file of [names.webm, names.mp4])
      expect(
        Number(probe(join(directory, file), "format=duration", false)),
      ).toBeCloseTo(expectedFrames / videoSpec.fps, 1);
  });

  it("makes a still of the scene's own picture at the moment chosen for a still", async () => {
    const directory = await folder();
    await renderScene(test, directory);
    const poster = join(directory, videoFiles(test.id).poster);
    expect(probe(poster, "stream=codec_name,width,height")).toBe("png,640,360");
    // 0.55 of a two second loop is 1.1 seconds: the third half-second, which is blue.
    const pixel = execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      poster,
      "-vf",
      "crop=1:1:0:0",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ]);
    expect([...pixel]).toEqual([0, 0, 255]);
  });
});

describe("running the encoder", () => {
  it("says so when the encoder is not installed, instead of leaving a missing file", async () => {
    await expect(
      runEncoder(["-version"], [], "no-such-encoder"),
    ).rejects.toThrow("no-such-encoder could not start");
  });

  it("does not wait for frames to be taken by an encoder that never started, and leaves no unhandled error", async () => {
    const chunk = new Uint8Array(64 * 1024);
    function* frames(): Generator<Uint8Array> {
      for (let index = 0; index < 1_000; index += 1) yield chunk;
    }
    await expect(
      runEncoder(["-version"], frames(), "no-such-encoder"),
    ).rejects.toThrow("no-such-encoder could not start");
  }, 10_000);

  it("says what the encoder said when it refuses its arguments", async () => {
    await expect(
      runEncoder(["-hide_banner", "-loglevel", "error", "-nope"], []),
    ).rejects.toThrow(/ffmpeg stopped with code/u);
  });

  it("is not upset by an encoder that has all it needs before the frames run out", async () => {
    const directory = await folder();
    const frame = new Uint8Array(160 * 90 * 4);
    await expect(
      runEncoder(
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgba",
          "-s",
          "160x90",
          "-i",
          "-",
          "-frames:v",
          "1",
          join(directory, "x.png"),
        ],
        Array.from({ length: 5000 }, () => frame),
      ),
    ).resolves.toBeUndefined();
  });
});
