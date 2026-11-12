import type { HeroId } from "../../rules/constants.ts";
import type { HeadShape } from "./head-shape.ts";
import type { ShoeColours } from "./patterns.ts";
import type { Build } from "./rig.ts";

// How each of the family looks, from the book and its cover: build and age, face, skin, clothes, hair. One signature each, never lost:
// Daddy's freeform locs standing up like a crown, his goatee and gold earring; Mama's galaxy afro with its headband and feather, her
// feather earrings and the gold markings on her skin; Kai's curly top and his star-and-moon pyjamas; Zora's two galaxy puffs tied with
// gold beads, her little feather earrings and her lavender hoodie. Each has shoes of their own and, once woven, a maridium jacket in
// their own colours. Storybook proportions: the children's heads are big for their bodies, and everyone's eyes are big for their heads.
export type HairKind = "afro" | "coils" | "locs" | "puffs";

export interface Look {
  readonly bottom: string;
  readonly build: Build;
  // The shape of the head and face: Daddy's long, with his strong jaw and cheekbones; Mama's an oval with high cheekbones and a pointed
  // chin; the children's rounder and full in the cheek.
  readonly face: HeadShape;
  readonly galaxy: boolean;
  readonly hair: HairKind;
  readonly hairColour: string;
  readonly hairVolume: number;
  readonly jacket: string;
  readonly marks: boolean;
  // The three bold colours worked into the jacket's bands.
  readonly marks3: readonly [string, string, string];
  readonly shoes: ShoeColours;
  readonly name: string;
  readonly skin: string;
  readonly skirt: boolean;
  readonly sleeves: "long" | "none";
  readonly stars: boolean;
  readonly top: string;
  readonly beard: boolean;
  readonly feather: boolean;
}

export const looks: Readonly<Record<HeroId, Look>> = {
  ali: {
    beard: true,
    bottom: "#3d4232",
    build: {
      foot: 0.26,
      forearm: 0.27,
      hand: 0.18,
      head: 0.146,
      hip: 0.15,
      limb: 0.05,
      neck: 0.06,
      shin: 0.43,
      shoulder: 0.21,
      thigh: 0.45,
      torso: 0.6,
      upperArm: 0.3,
    },
    face: {
      cheeks: 0.15,
      chin: 1.14,
      jaw: 0.75,
      point: 0.15,
      wide: 0.83,
      young: 0,
    },
    feather: false,
    galaxy: false,
    hair: "locs",
    hairColour: "#1a110c",
    hairVolume: 1,
    jacket: "#3b2468",
    marks: false,
    marks3: ["#e8742a", "#1fa39a", "#c8372d"],
    name: "Dr. Ali Savage",
    shoes: {
      cap: "#4a2a16",
      kind: "boot",
      lace: "#c9a25a",
      sole: "#1c130d",
      upper: "#5a341c",
    },
    skin: "#6a3e25",
    skirt: false,
    sleeves: "long",
    stars: false,
    top: "#8b8c88",
  },
  heerah: {
    beard: false,
    bottom: "#11807a",
    build: {
      foot: 0.22,
      forearm: 0.235,
      hand: 0.16,
      head: 0.138,
      hip: 0.165,
      limb: 0.041,
      neck: 0.07,
      shin: 0.4,
      shoulder: 0.17,
      thigh: 0.42,
      torso: 0.54,
      upperArm: 0.27,
    },
    face: {
      cheeks: 0.2,
      chin: 1.08,
      jaw: 0.25,
      point: 0.8,
      wide: 0.82,
      young: 0,
    },
    feather: true,
    galaxy: true,
    hair: "afro",
    hairColour: "#4b2a86",
    hairVolume: 1.25,
    jacket: "#0f5e63",
    marks: true,
    marks3: ["#d94f8a", "#f0a13a", "#7b4bc0"],
    name: "Mama Heerah",
    shoes: {
      cap: "#d9a441",
      kind: "flat",
      lace: "#f6e6c0",
      sole: "#3a2414",
      upper: "#d9a441",
    },
    skin: "#8b5535",
    skirt: true,
    sleeves: "none",
    stars: false,
    top: "#16958a",
  },
  kai: {
    beard: false,
    bottom: "#1c2a5c",
    build: {
      foot: 0.19,
      forearm: 0.19,
      hand: 0.135,
      head: 0.142,
      hip: 0.115,
      limb: 0.04,
      neck: 0.045,
      shin: 0.3,
      shoulder: 0.14,
      thigh: 0.32,
      torso: 0.42,
      upperArm: 0.215,
    },
    face: {
      cheeks: 0.6,
      chin: 0.98,
      jaw: 0.45,
      point: 0.35,
      wide: 0.88,
      young: 0.7,
    },
    feather: false,
    galaxy: false,
    hair: "coils",
    hairColour: "#1b120c",
    hairVolume: 1,
    jacket: "#17357a",
    marks: false,
    marks3: ["#f2c14e", "#3fc1e8", "#e8742a"],
    name: "Kai",
    shoes: {
      cap: "#f1ede4",
      kind: "sneaker",
      lace: "#f2c14e",
      sole: "#f1ede4",
      upper: "#1c2a5c",
    },
    skin: "#7a4a2b",
    skirt: false,
    sleeves: "long",
    stars: true,
    top: "#1c2a5c",
  },
  zora: {
    beard: false,
    bottom: "#b49ddb",
    build: {
      foot: 0.16,
      forearm: 0.155,
      hand: 0.115,
      head: 0.14,
      hip: 0.105,
      limb: 0.036,
      neck: 0.035,
      shin: 0.235,
      shoulder: 0.12,
      thigh: 0.255,
      torso: 0.34,
      upperArm: 0.175,
    },
    face: {
      cheeks: 0.9,
      chin: 0.9,
      jaw: 0.35,
      point: 0.45,
      wide: 0.9,
      young: 1,
    },
    feather: false,
    galaxy: true,
    hair: "puffs",
    hairColour: "#4a2c8c",
    hairVolume: 1,
    jacket: "#d9722a",
    marks: false,
    marks3: ["#1b9aa0", "#f6d36b", "#5b2f8f"],
    name: "Zora",
    shoes: {
      cap: "#f6f1fa",
      kind: "sneaker",
      lace: "#f6f1fa",
      sole: "#f6f1fa",
      upper: "#8f6fc9",
    },
    skin: "#7d4b2d",
    skirt: false,
    sleeves: "long",
    stars: false,
    top: "#b49ddb",
  },
};

// The height of a body from its feet to the top of its head (hair not counted), for the camera and the hands that reach.
export function heightOf(build: Build): number {
  return (
    build.thigh +
    build.shin +
    build.foot * 0.35 +
    build.torso * 1.0 +
    build.neck +
    build.head * 2.1
  );
}
