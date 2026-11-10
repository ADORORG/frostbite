import type { SoundSettings } from "@frostbite/game-sdk/audio/settings";
import {
  finishRun,
  freshProgress,
  restore,
  withSound,
  type Progress,
} from "@frostbite/game-sdk/best-progress";
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";
import {
  connectToPlatform,
  sendRun,
  type PlatformPlay,
} from "@frostbite/game-sdk/play";
import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { milestones } from "./rules/milestones.ts";
import { words } from "./words.ts";

// Everything the page asks of the platform, in one place: connecting, the best score and the sound settings it keeps for the player, a run
// to play (with its seed), the milestones as they are earned, and the finished run. Nothing is kept anywhere else: the frame has no storage.
export interface Platform {
  readonly best: () => number;
  readonly connect: (apply: (sound: SoundSettings) => void) => Promise<string>;
  readonly keepSound: (settings: SoundSettings) => void;
  readonly report: (id: string) => void;
  readonly send: (record: RunRecord) => Promise<void>;
  // Records the score of a finished run; says whether it is a new best.
  readonly settle: (score: number) => boolean;
  readonly start: () => Promise<number>;
  readonly titleOf: (id: string) => string;
}

const localTitles = new Map(milestones.map(({ id, name }) => [id, name]));

export function createPlatform(): Platform {
  const client = createGameClient();
  let progress: Progress = freshProgress;
  let play: PlatformPlay | null = null;
  let runId: string | null = null;
  let titles = new Map<string, string>();
  const save = (): void =>
    void client.progress
      .save({ best: progress.best, sound: progress.sound })
      .catch(() => undefined);
  return {
    best: () => progress.best,
    async connect(apply) {
      try {
        await client.ready();
        progress = restore(await client.progress.load());
        apply(progress.sound);
        play = await connectToPlatform(client);
        const listed = await client.milestones.list().catch(() => []);
        titles = new Map(listed.map(({ id, title }) => [id, title]));
        return words.connected;
      } catch (error) {
        return error instanceof GameHostError
          ? `The platform said: ${error.code}`
          : words.offline;
      }
    },
    keepSound(settings) {
      progress = withSound(progress, settings);
      save();
    },
    report: (id) => play?.report(id),
    send: (record) => sendRun(play, runId, record),
    settle(score) {
      const done = finishRun(progress, score);
      progress = done.progress;
      save();
      return done.newBest;
    },
    // A run on the platform's seed, or (with no platform to give one) on a seed of the page's own, which nothing will check.
    async start() {
      const started = await play?.runs.start().catch(() => null);
      const ready = started?.status === "started" ? started : null;
      runId = ready?.runId ?? null;
      return ready?.seed ?? Math.floor(Math.random() * 0x1_0000_0000);
    },
    titleOf: (id) => titles.get(id) ?? localTitles.get(id) ?? id,
  };
}
