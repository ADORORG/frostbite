import type {
  BufferLike,
  ContextLike,
  GainLike,
  NodeLike,
  NoiseSourceLike,
  OscillatorLike,
  ParamLike,
} from "./context.ts";
import type { Timer } from "./engine.ts";

// A stand-in for the browser's audio that writes down what was asked of it, for the tests of a game and of the SDK itself.
export interface Started {
  readonly at: number;
  readonly from: number;
  readonly gain: number;
  readonly to: number | null;
  readonly wave: string;
}

export class Param implements ParamLike {
  value = 0;
  readonly calls: [string, number, number][] = [];
  cancelScheduledValues(): void {}
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push(["exp", value, time]);
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push(["lin", value, time]);
  }
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push(["set", value, time]);
  }
}

class Node implements NodeLike {
  readonly outputs: NodeLike[] = [];
  connect(destination: NodeLike): void {
    this.outputs.push(destination);
  }
}

class Gain extends Node implements GainLike {
  readonly gain = new Param();
}

export class FakeContext implements ContextLike {
  currentTime = 0;
  readonly destination = new Node();
  readonly gains: Gain[] = [];
  readonly oscillators: (OscillatorLike & {
    readonly frequency: Param;
    readonly starts: number[];
    readonly stops: number[];
  })[] = [];
  readonly noises: NoiseSourceLike[] = [];
  readonly sampleRate = 100;
  state: AudioContextState = "suspended";
  readonly calls: string[] = [];
  createBuffer(_channels: number, length: number): BufferLike {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource(): NoiseSourceLike {
    const source = Object.assign(new Node(), {
      buffer: null as BufferLike | null,
      loop: false,
      start: () => undefined,
      stop: () => undefined,
    });
    this.noises.push(source);
    return source;
  }
  createGain(): Gain {
    const made = new Gain();
    this.gains.push(made);
    return made;
  }
  createOscillator() {
    const starts: number[] = [];
    const stops: number[] = [];
    const made = Object.assign(new Node(), {
      frequency: new Param(),
      start: (time: number) => void starts.push(time),
      starts,
      stop: (time: number) => void stops.push(time),
      stops,
      type: "sine" as OscillatorType,
    });
    this.oscillators.push(made);
    return made;
  }
  resume(): Promise<void> {
    this.calls.push("resume");
    this.state = "running";
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.calls.push("suspend");
    this.state = "suspended";
    return Promise.resolve();
  }
}

// A timer the test turns by hand.
export function manualTimer(): Timer & { fire(): void; stopped: boolean } {
  let pending: (() => void) | null = null;
  const timer = {
    every(run: () => void) {
      pending = run;
      return () => {
        timer.stopped = true;
      };
    },
    fire() {
      pending?.();
    },
    stopped: false,
  };
  return timer;
}

// Puts the fake where a page looks for the browser's audio, with a clock that runs in real time so music is scheduled as it would be.
export function installFakeAudio(target: object): FakeContext {
  const context = new FakeContext();
  const began = performance.now();
  Object.defineProperty(context, "currentTime", {
    get: () => (performance.now() - began) / 1000,
  });
  Object.defineProperty(target, "AudioContext", {
    configurable: true,
    value: function FakeAudioContext() {
      return context;
    },
  });
  return context;
}
