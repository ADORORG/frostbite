import type { News, PlayState } from "../rules/types.ts";
import { heroCards } from "../script/cast.ts";
import {
  type CardWords,
  cardFor,
  flyingCard,
  showCard,
} from "../script/cards.ts";
import { farewell } from "../view/farewell.ts";

// Share cards: at each turning point of the story the page takes a picture of the moment (a second or so after it, once the camera has
// found it) and keeps it with its words. The lit tree has three: the big hug at the tree, the show, and the lift-off. A card is drawn
// from them in the size asked for: a square post or a tall story, the picture in a gold frame, the title, the line, and the game's name.
export type Shape = "square" | "story";

export interface Card {
  readonly lead: string;
  readonly photo: HTMLCanvasElement;
  readonly words: CardWords;
}

export const sizes: Readonly<Record<Shape, readonly [number, number]>> = {
  square: [1080, 1080],
  story: [1080, 1920],
};

// How long after the news the picture is taken.
export const settleMs = 1_200;
// The lit tree's two: the big hug at the tree, facing the screen, the ancestors behind; and the family lifting off, three seconds in.
export const hugMs = farewell.portrait * 1_000;
export const showMs = (farewell.show[0] + 20) * 1_000;
export const flightMs = (farewell.liftOff + 3) * 1_000;

export interface CardMaker {
  // The cards of this run so far.
  readonly cards: () => readonly Card[];
  // Hears the news of a run: a turning point is a picture to take.
  readonly hear: (news: News, state: PlayState, now: number) => void;
  // Called just after the screen is drawn: takes a picture that is due from it.
  readonly snap: (screen: CanvasImageSource | null, now: number) => Card | null;
  readonly clear: () => void;
}

export function createCardMaker(): CardMaker {
  let cards: Card[] = [];
  let due: { at: number; lead: string; words: CardWords }[] = [];
  return {
    cards: () => cards,
    clear() {
      cards = [];
      due = [];
    },
    hear(news, state, now) {
      const words = cardFor(news, state);
      if (words === null) return;
      const lead = state.lead === null ? "" : heroCards[state.lead].name;
      if (news.kind !== "lit") {
        due.push({ at: now + settleMs, lead, words });
        return;
      }
      due.push(
        { at: now + hugMs, lead, words },
        { at: now + showMs, lead, words: showCard },
        { at: now + flightMs, lead, words: flyingCard },
      );
    },
    snap(screen, now) {
      const next = due[0];
      if (next === undefined || now < next.at) return null;
      due = due.slice(1);
      const photo = document.createElement("canvas");
      photo.width = 960;
      photo.height = 540;
      const context = photo.getContext("2d");
      if (context === null) return null;
      context.fillStyle = "#1d1347";
      context.fillRect(0, 0, photo.width, photo.height);
      if (screen !== null)
        context.drawImage(screen, 0, 0, photo.width, photo.height);
      const card = { lead: next.lead, photo, words: next.words };
      cards = [...cards, card];
      return card;
    },
  };
}

// Breaks a line of words into lines no wider than `width`.
export function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const tried = line === "" ? word : `${line} ${word}`;
    if (line !== "" && context.measureText(tried).width > width) {
      lines.push(line);
      line = word;
    } else line = tried;
  }
  if (line !== "") lines.push(line);
  return lines;
}

// Draws a card at its size onto `canvas`.
export function paintCard(
  canvas: HTMLCanvasElement,
  card: Card,
  shape: Shape,
): boolean {
  const [width, height] = sizes[shape];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return false;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#120b2e");
  sky.addColorStop(1, "#3a2a7a");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  // The picture, cut to the frame's shape from the middle.
  const frame = shape === "square" ? [60, 60, 960, 640] : [60, 200, 960, 1160];
  const [fx = 0, fy = 0, fw = 0, fh = 0] = frame;
  const scale = Math.max(fw / card.photo.width, fh / card.photo.height);
  const cutWidth = fw / scale;
  const cutHeight = fh / scale;
  context.drawImage(
    card.photo,
    (card.photo.width - cutWidth) / 2,
    (card.photo.height - cutHeight) / 2,
    cutWidth,
    cutHeight,
    fx,
    fy,
    fw,
    fh,
  );
  context.strokeStyle = "#ffc74a";
  context.lineWidth = 8;
  context.strokeRect(fx, fy, fw, fh);
  context.textAlign = "center";
  context.fillStyle = "#ffc74a";
  context.font = "bold 64px Georgia, serif";
  const words = fy + fh + (shape === "square" ? 110 : 150);
  context.fillText(card.words.title, width / 2, words);
  context.fillStyle = "#fff3dc";
  context.font = "36px Georgia, serif";
  wrap(context, card.words.line, 900).forEach((line, index) => {
    context.fillText(line, width / 2, words + 70 + index * 48);
  });
  context.fillStyle = "#c7b8f2";
  context.font = "28px system-ui, sans-serif";
  const footer =
    card.lead === ""
      ? "PEACEFUL SAVAGE: LIGHT THE TREE"
      : `PEACEFUL SAVAGE: LIGHT THE TREE · LED BY ${card.lead.toUpperCase()}`;
  context.fillText(footer, width / 2, height - 44);
  return true;
}
