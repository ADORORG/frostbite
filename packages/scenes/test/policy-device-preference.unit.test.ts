import { describe, expect, it } from "vitest";

import {
  createPreference,
  playbackFor,
  playbackLimits,
  preferenceKey,
  readDeviceSignals,
  type DeviceSignals,
} from "../src/engine/index.ts";

const calm: DeviceSignals = {
  lowPower: false,
  reducedMotion: false,
  saveData: false,
};

describe("whether scenes move", () => {
  it("moves them for a device that asks for nothing and a person who chose nothing", () => {
    expect(playbackFor(calm, null)).toBe("play");
  });

  it.each([
    ["reduced motion", { ...calm, reducedMotion: true }],
    ["data saver", { ...calm, saveData: true }],
    ["a weak device", { ...calm, lowPower: true }],
  ])("shows stills for %s when the person has chosen nothing", (_, device) => {
    expect(playbackFor(device, null)).toBe("still");
  });

  it("lets the person's choice win over the device either way", () => {
    const asksForLess = { lowPower: true, reducedMotion: true, saveData: true };
    expect(playbackFor(asksForLess, "on")).toBe("play");
    expect(playbackFor(calm, "off")).toBe("still");
  });
});

describe("reading what the device asks for", () => {
  const source = (over: { matches?: boolean; navigator?: object }) => ({
    matchMedia: (query: string) => ({
      matches: query.includes("reduce") && over.matches === true,
    }),
    navigator: over.navigator ?? {},
  });

  it("reads reduced motion from the media query", () => {
    expect(readDeviceSignals(source({ matches: true })).reducedMotion).toBe(
      true,
    );
    expect(readDeviceSignals(source({})).reducedMotion).toBe(false);
  });

  it("takes the data saver flag only when the browser says so", () => {
    expect(
      readDeviceSignals(
        source({ navigator: { connection: { saveData: true } } }),
      ).saveData,
    ).toBe(true);
    expect(
      readDeviceSignals(
        source({ navigator: { connection: { saveData: false } } }),
      ).saveData,
    ).toBe(false);
    expect(
      readDeviceSignals(source({ navigator: { connection: null } })).saveData,
    ).toBe(false);
    expect(readDeviceSignals(source({})).saveData).toBe(false);
  });

  it("calls a device weak at the memory limit and below, and not when it does not say", () => {
    const memory = (deviceMemory: unknown) =>
      readDeviceSignals(source({ navigator: { deviceMemory } })).lowPower;
    expect(memory(playbackLimits.lowMemoryGb)).toBe(true);
    expect(memory(playbackLimits.lowMemoryGb + 2)).toBe(false);
    expect(memory("1")).toBe(false);
    expect(readDeviceSignals(source({})).lowPower).toBe(false);
  });
});

describe("the remembered choice", () => {
  const store = (initial?: string) => {
    const kept = new Map<string, string>(
      initial === undefined ? [] : [[preferenceKey, initial]],
    );
    return {
      getItem: (key: string) => kept.get(key) ?? null,
      kept,
      setItem: (key: string, value: string) => void kept.set(key, value),
    };
  };

  it("remembers what is written and reads it back", () => {
    const storage = store();
    const preference = createPreference(storage);
    expect(preference.read()).toBeNull();
    preference.write("off");
    expect(storage.kept.get(preferenceKey)).toBe("off");
    expect(preference.read()).toBe("off");
    preference.write("on");
    expect(preference.read()).toBe("on");
  });

  it("reads anything it did not write as no choice", () => {
    expect(createPreference(store("maybe")).read()).toBeNull();
    expect(createPreference(store("")).read()).toBeNull();
  });

  it("works with no storage, and with storage that throws, without failing the page", () => {
    const none = createPreference(null);
    none.write("on");
    expect(none.read()).toBeNull();
    const broken = createPreference({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => broken.write("on")).not.toThrow();
    expect(broken.read()).toBeNull();
  });
});
