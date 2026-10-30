// The small part of the browser's audio context the engine uses, named here so a test can stand in for it. The real `AudioContext`
// satisfies it as it is.
export interface ParamLike {
  value: number;
  cancelScheduledValues(time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  setValueAtTime(value: number, time: number): unknown;
}

export interface NodeLike {
  connect(destination: NodeLike): unknown;
}

export interface GainLike extends NodeLike {
  readonly gain: ParamLike;
}

export interface OscillatorLike extends NodeLike {
  readonly frequency: ParamLike;
  start(time: number): void;
  stop(time: number): void;
  type: OscillatorType;
}

export interface BufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface NoiseSourceLike extends NodeLike {
  buffer: BufferLike | null;
  loop: boolean;
  start(time: number): void;
  stop(time: number): void;
}

export interface ContextLike {
  readonly currentTime: number;
  createBuffer(channels: number, length: number, rate: number): BufferLike;
  createBufferSource(): NoiseSourceLike;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  readonly destination: NodeLike;
  resume(): Promise<void>;
  readonly sampleRate: number;
  readonly state: AudioContextState;
  suspend(): Promise<void>;
}
