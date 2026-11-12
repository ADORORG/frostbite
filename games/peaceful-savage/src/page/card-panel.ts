import { type Card, paintCard, type Shape } from "./cards.ts";
import { element } from "./elements.ts";

// The panel where a player keeps a card: the run's cards one by one, in either size, to download or share. The platform's frame may
// forbid downloads and sharing, so the panel always says how to save the picture by hand (the browser's own menu on an image works in
// any frame).
const saveHint =
  "Right-click (or press and hold) the card to save the picture, then share it from your photos.";
const triedHint =
  "If nothing was saved, right-click or press and hold the card and choose to save the image.";
const noShare =
  "Sharing is not offered here. Save the card, then share it from your photos.";

export interface CardPanel {
  close(): void;
  isOpen(): boolean;
  // Opens on a run's cards, at the newest.
  open(cards: readonly Card[]): void;
}

export function createCardPanel(): CardPanel {
  const root = element("card-panel", "div");
  const image = element("card-image", "img");
  const hint = element("card-hint", "p");
  const count = element("card-count", "span");
  const previous = element("card-previous", "button");
  const next = element("card-next", "button");
  const shapes = [...root.querySelectorAll("button[data-shape]")].filter(
    (found) => found instanceof HTMLButtonElement,
  );
  let cards: readonly Card[] = [];
  let at = 0;
  let shape: Shape = "square";
  const canvas = document.createElement("canvas");

  function show(): void {
    const card = cards[at];
    if (card === undefined) return;
    count.textContent = `${String(at + 1)} of ${String(cards.length)}`;
    previous.disabled = at === 0;
    next.disabled = at >= cards.length - 1;
    for (const button of shapes)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.shape === shape),
      );
    if (!paintCard(canvas, card, shape)) {
      hint.textContent = "This browser could not draw the card.";
      return;
    }
    image.src = canvas.toDataURL("image/png");
    image.alt = `${card.words.title}. ${card.words.line}`;
    hint.textContent = saveHint;
  }

  const fileName = (): string =>
    `peaceful-savage-${(cards[at]?.words.title ?? "card").toLowerCase().replace(/[^a-z]+/g, "-")}-${shape}.png`;

  function download(): void {
    const link = document.createElement("a");
    link.href = image.src;
    link.download = fileName();
    link.click();
    hint.textContent = triedHint;
  }

  function share(): void {
    const card = cards[at];
    if (card === undefined) return;
    canvas.toBlob((blob) => {
      const file =
        blob === null
          ? null
          : new File([blob], fileName(), { type: "image/png" });
      const offer = {
        files: file === null ? [] : [file],
        title: card.words.title,
      };
      if (
        file === null ||
        typeof navigator.canShare !== "function" ||
        !navigator.canShare(offer)
      ) {
        hint.textContent = noShare;
        return;
      }
      navigator.share(offer).then(
        () => {
          hint.textContent = "Shared. Thank you for passing the light on.";
        },
        () => {
          hint.textContent = saveHint;
        },
      );
    });
  }

  previous.addEventListener("click", () => {
    at = Math.max(0, at - 1);
    show();
  });
  next.addEventListener("click", () => {
    at = Math.min(cards.length - 1, at + 1);
    show();
  });
  for (const button of shapes)
    button.addEventListener("click", () => {
      shape = button.dataset.shape === "story" ? "story" : "square";
      show();
    });
  element("card-download", "button").addEventListener("click", download);
  element("card-share", "button").addEventListener("click", share);
  const close = (): void => {
    root.hidden = true;
  };
  element("card-close", "button").addEventListener("click", close);
  return {
    close,
    isOpen: () => !root.hidden,
    open(list) {
      if (list.length === 0) return;
      cards = list;
      at = list.length - 1;
      root.hidden = false;
      show();
    },
  };
}
