import { z } from "zod";

// What a player chooses about sound: music and effects separately, and one volume. The frame has no storage of its own, so a game
// keeps this beside its progress (the platform saves that); `parseSound` is how it reads it back, falling back to the defaults for
// anything missing or wrong rather than trusting it.
export const soundSettingsSchema = z.strictObject({
  effects: z.boolean(),
  music: z.boolean(),
  volume: z.number().min(0).max(1),
});

export type SoundSettings = z.infer<typeof soundSettingsSchema>;

export const defaultSound: SoundSettings = {
  effects: true,
  music: true,
  volume: 0.6,
};

export function parseSound(value: unknown): SoundSettings {
  const parsed = soundSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultSound;
}
