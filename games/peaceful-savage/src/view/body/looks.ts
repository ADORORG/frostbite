import type { HeroId } from "../../rules/constants.ts";
import type { Build } from "./rig.ts";

// How each of the family looks, from the book: build and age, skin, clothes, hair. One signature each, never lost: Daddy's cool afro
// with his gold pick, Mama's galaxy afro with its feathers and feather earrings and the gold markings on her skin, Kai's coily top and his
// star-and-moon pyjamas, Zora's two galaxy puffs and her lavender hoodie. Storybook proportions: the children's heads are big for their
// bodies, and everyone's eyes are big for their heads.
export type HairKind = "afro" | "coils" | "puffs";

export interface Look {
  readonly bottom: string;
  readonly build: Build;
  readonly galaxy: boolean;
  readonly hair: HairKind;
  readonly hairColour: string;
  readonly hairVolume: number;
  readonly jacket: string;
  readonly marks: boolean;
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
      head: 0.13,
      hip: 0.15,
      limb: 0.05,
      neck: 0.06,
      shin: 0.43,
      shoulder: 0.21,
      thigh: 0.45,
      torso: 0.6,
      upperArm: 0.3,
    },
    feather: false,
    galaxy: false,
    hair: "afro",
    hairColour: "#1a110c",
    hairVolume: 1,
    jacket: "#55308a",
    marks: false,
    name: "Dr. Ali Savage",
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
      head: 0.122,
      hip: 0.165,
      limb: 0.041,
      neck: 0.07,
      shin: 0.4,
      shoulder: 0.17,
      thigh: 0.42,
      torso: 0.54,
      upperArm: 0.27,
    },
    feather: true,
    galaxy: true,
    hair: "afro",
    hairColour: "#4b2a86",
    hairVolume: 1.25,
    jacket: "#126e74",
    marks: true,
    name: "Mama Heerah",
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
      head: 0.126,
      hip: 0.115,
      limb: 0.04,
      neck: 0.045,
      shin: 0.3,
      shoulder: 0.14,
      thigh: 0.32,
      torso: 0.42,
      upperArm: 0.215,
    },
    feather: false,
    galaxy: false,
    hair: "coils",
    hairColour: "#1b120c",
    hairVolume: 1,
    jacket: "#1f4f78",
    marks: false,
    name: "Kai",
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
      head: 0.126,
      hip: 0.105,
      limb: 0.036,
      neck: 0.035,
      shin: 0.235,
      shoulder: 0.12,
      thigh: 0.255,
      torso: 0.34,
      upperArm: 0.175,
    },
    feather: false,
    galaxy: true,
    hair: "puffs",
    hairColour: "#4a2c8c",
    hairVolume: 1,
    jacket: "#6a3fa0",
    marks: false,
    name: "Zora",
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
