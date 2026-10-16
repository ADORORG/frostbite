import { attributeChecks, referencedId } from "./values.ts";
import {
  assertPolicy,
  refuse,
  type DrawingPolicy,
  type DrawingResult,
  type Failure,
} from "./policy.ts";
import { parseSubset, type XmlElement } from "./xml.ts";

const svgNamespace = "http://www.w3.org/2000/svg";

// The elements a milestone drawing may use: shapes, groups and gradients. No text (it needs fonts that are not on chain), no
// images or links, no scripts, styles or animation.
const allowedElements: ReadonlySet<string> = new Set([
  "circle",
  "clipPath",
  "defs",
  "ellipse",
  "g",
  "line",
  "linearGradient",
  "path",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "svg",
]);

interface Scan {
  readonly ids: Set<string>;
  readonly references: string[];
}

function check(node: XmlElement, root: boolean, scan: Scan): Failure | null {
  if (!allowedElements.has(node.name)) {
    return refuse("unknown-element", `Element ${node.name} is not allowed.`);
  }
  if (node.name === "svg" && !root) {
    return refuse("unknown-element", "A drawing has one svg element.");
  }
  for (const [name, value] of node.attributes) {
    if (name === "xmlns") {
      // The root's namespace was checked before the walk; anywhere else it is not allowed.
      if (!root)
        return refuse("bad-value", "xmlns is allowed only on the root.");
      continue;
    }
    const valid = attributeChecks[name];
    if (valid === undefined) {
      return refuse("unknown-attribute", `Attribute ${name} is not allowed.`);
    }
    if (!valid(value)) {
      return refuse(
        "bad-value",
        `Attribute ${name} has a value that is not allowed.`,
      );
    }
    if (name === "id") {
      if (scan.ids.has(value))
        return refuse("bad-reference", `Id ${value} is used twice.`);
      scan.ids.add(value);
    }
    const target = referencedId(value);
    if (target !== null) scan.references.push(target);
  }
  for (const child of node.children) {
    const failure = check(child, false, scan);
    if (failure !== null) return failure;
  }
  return null;
}

// Elements without children are written self-closed, except the root: the contract wants a drawing to end with `</svg>`.
function write(node: XmlElement, root = false): string {
  const attributes = node.attributes
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  return node.children.length === 0 && !root
    ? `<${node.name}${attributes}/>`
    : `<${node.name}${attributes}>${node.children.map((child) => write(child)).join("")}</${node.name}>`;
}

// Cleans a builder's drawing before it goes on chain. The drawing is read as a strict subset of SVG, every element, attribute
// and value is checked against an allow-list, and the result is written out fresh in one canonical form, so what reaches the
// chain is never the builder's own text. A drawing outside the allow-list is refused with the reason, not repaired.
export function sanitizeDrawing(
  drawing: string,
  policy: DrawingPolicy,
): DrawingResult {
  assertPolicy(policy);
  if (new TextEncoder().encode(drawing).length > policy.maxBytes) {
    return refuse("too-large", "The drawing is larger than the limit.");
  }
  const parsed = parseSubset(drawing, policy);
  if (!parsed.ok) return parsed;
  const { root } = parsed;
  if (root.name !== "svg")
    return refuse("missing-root", "The drawing must be one svg element.");
  const attributes = new Map(root.attributes);
  if (attributes.get("xmlns") !== svgNamespace) {
    return refuse("bad-value", "The root must declare the SVG namespace.");
  }
  if (!attributes.has("viewBox"))
    return refuse("bad-value", "The root must have a viewBox.");
  const scan: Scan = { ids: new Set(), references: [] };
  const failure = check(root, true, scan);
  if (failure !== null) return failure;
  const missing = scan.references.find((target) => !scan.ids.has(target));
  if (missing !== undefined) {
    return refuse(
      "bad-reference",
      `Reference #${missing} points to nothing in the drawing.`,
    );
  }
  const svg = write(root, true);
  if (new TextEncoder().encode(svg).length > policy.maxBytes) {
    return refuse("too-large", "The cleaned drawing is larger than the limit.");
  }
  return { ok: true, svg };
}
