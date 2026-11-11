// A 2D drawing surface that notes what is drawn on it: every call by name, with its arguments, and every line of text with the colour it was
// written in. Whatever is asked of it is answered, so any drawing code can run on it.
export interface Call {
  readonly name: string;
  readonly args: readonly unknown[];
}

export function recorder() {
  const calls: Call[] = [];
  const written: { text: string; fill: string }[] = [];
  const values: Record<string, unknown> = { fillStyle: "", font: "" };
  const gradient = () => ({ addColorStop: () => undefined });
  const context = new Proxy(values, {
    get(target, key) {
      if (typeof key !== "string") return undefined;
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push({ args, name: key });
        if (key === "fillText")
          written.push({
            fill: String(target.fillStyle),
            text: String(args[0]),
          });
        if (key === "measureText")
          return { width: String(args[0]).length * 10 };
        if (key.startsWith("create")) return gradient();
        return undefined;
      };
    },
    set(target, key, value) {
      if (typeof key === "string") target[key] = value;
      return true;
    },
  });
  return {
    calls,
    context: context as unknown as CanvasRenderingContext2D,
    named: (name: string) => calls.filter((call) => call.name === name),
    texts: () => written.map(({ text }) => text),
    written,
  };
}
