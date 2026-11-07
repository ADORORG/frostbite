import type { JsonValue } from "@frostbite/game-sdk/protocol";
import {
  fieldsOf,
  refuse,
  tickNamed,
  withFields,
} from "@frostbite/game-sdk/run-inputs";
import type { RunInput, Stepped } from "@frostbite/game-sdk/run-record";

// The inputs every chapter takes, and how they are checked, in one place. A run record holds only when a control was pressed or let
// go of (`{ tick, on }`, `on` 1 or 0) and when the run was closed (`end` `{ tick }`); the rules play the ticks between. Each chapter
// names its own controls, how far a run may go, how to play on to a tick, when a run is over, and what a press does at once.
export interface Running<Control extends string> {
  readonly controls: Readonly<Record<Control, boolean>>;
  readonly ended: boolean;
  readonly tick: number;
}

export interface Chapter<
  Control extends string,
  State extends Running<Control>,
> {
  readonly controls: readonly Control[];
  readonly maxTicks: number;
  advanceTo(state: State, tick: number): State;
  // Won or lost: from then on only `end` is taken.
  done(state: State): boolean;
  // What pressing a control does on the tick it is pressed (a jump remembered, a menu moved); holding it is the tick's business.
  pressed(state: State, control: Control): State;
}

// A control pressed or let go of on the tick the run is at: refused once the run is over, or if it is already so. The quest takes its
// changes through this too, so a chapter played alone and the same chapter in the quest take a press the same way.
export function change<Control extends string, State extends Running<Control>>(
  chapter: Chapter<Control, State>,
  state: State,
  control: Control,
  on: boolean,
): Stepped<State> {
  if (chapter.done(state)) return refuse("the run is over");
  if (state.controls[control] === on)
    return refuse(`${control} is already ${on ? "held" : "released"}`);
  const held: State = {
    ...state,
    controls: { ...state.controls, [control]: on },
  };
  return { ok: true, state: on ? chapter.pressed(held, control) : held };
}

function hold<Control extends string, State extends Running<Control>>(
  chapter: Chapter<Control, State>,
  state: State,
  control: Control,
  data: JsonValue | undefined,
): Stepped<State> {
  return withFields(data, ["on", "tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, chapter.maxTicks);
    if (typeof tick === "string") return refuse(tick);
    if (fields.on !== 0 && fields.on !== 1)
      return refuse("on must be 1 (pressed) or 0 (released)");
    return change(
      chapter,
      chapter.advanceTo(state, tick),
      control,
      fields.on === 1,
    );
  });
}

function finish<Control extends string, State extends Running<Control>>(
  chapter: Chapter<Control, State>,
  state: State,
  data: JsonValue | undefined,
): Stepped<State> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, chapter.maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...chapter.advanceTo(state, tick), ended: true } };
  });
}

// One step of a chapter's rules: a control pressed or let go of, or the run closed.
export function stepChapter<
  Control extends string,
  State extends Running<Control>,
>(
  chapter: Chapter<Control, State>,
  state: State,
  input: RunInput,
): Stepped<State> {
  if (state.ended) return refuse("the run has ended");
  if (input.type === "end") return finish(chapter, state, input.data);
  const control = chapter.controls.find((name) => name === input.type);
  return control === undefined
    ? refuse(`no such input: ${input.type}`)
    : hold(chapter, state, control, input.data);
}

// A chapter takes no settings of its own (the cabinet's name is taken by the verifier before they get here).
export function noSettings<State>(
  config: Readonly<Record<string, JsonValue>>,
  start: () => State,
): Stepped<State> {
  const fields = fieldsOf(config, []);
  return typeof fields === "string"
    ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
    : { ok: true, state: start() };
}

// Plays a chapter on, tick by tick, to `tick`.
export function playOn<State extends { readonly tick: number }>(
  state: State,
  tick: number,
  once: (state: State) => State,
): State {
  let current = state;
  while (current.tick < tick) current = once(current);
  return current;
}
