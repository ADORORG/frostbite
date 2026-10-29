import { playbackLimits, type DeviceSignals } from "./policy.ts";

// What a browser can tell about the device. Reduced motion is a media query everywhere; the data saver flag and the amount of memory are
// reported by some browsers only, so their absence means "no request", not "off".
export interface DeviceSource {
  readonly matchMedia: (query: string) => { readonly matches: boolean };
  readonly navigator: object;
}

// The one place the browser's untyped hints are read. Each is checked before it is believed.
export function readDeviceSignals(source: DeviceSource): DeviceSignals {
  const connection: unknown = Reflect.get(source.navigator, "connection");
  const memory: unknown = Reflect.get(source.navigator, "deviceMemory");
  return {
    lowPower:
      typeof memory === "number" && memory <= playbackLimits.lowMemoryGb,
    reducedMotion: source.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    saveData:
      typeof connection === "object" &&
      connection !== null &&
      Reflect.get(connection, "saveData") === true,
  };
}
