import { cardOf, type CardContent, type CardFacts } from "../card/content.ts";
import { fileNameOf, layoutOf, shapes, type Shape } from "../card/layout.ts";
import { drawPoster } from "../card/poster.ts";
import { buttonsIn, element } from "./elements.ts";

// The panel where a player makes their card: pick a size, see it, and download it, share it or copy the invite link. The platform's
// frame may forbid downloads, sharing and the clipboard, so whatever happens the panel says how to save the picture by hand (the
// browser's own menu on an image works in any frame), and the link is there to select and copy.
const saveHint =
  "Download it, or right-click (or press and hold) the card to save or copy the picture.";
const savedHint =
  "If the download did not start, right-click or press and hold the card and choose to save the image.";
const noShare =
  "Sharing is not available here. Download the card and share it from your photos.";

export interface CardPanel {
  close(): void;
  isOpen(): boolean;
  open(facts: CardFacts): void;
  // Draws the card again with what is known now, if the panel is open.
  update(facts: CardFacts): void;
}

export function createCardPanel(onClosed: () => void): CardPanel {
  const root = element("card-panel", "div");
  const holo = element("card-holo", "div");
  const image = element("card-image", "img");
  const hint = element("card-hint", "p");
  const linkField = element("card-link", "input");
  const linkRow = element("card-link-row", "div");
  const download = element("card-download", "button");
  const send = element("card-send", "button");
  const copy = element("card-copy", "button");
  const shut = element("card-close", "button");
  const main = document.querySelector("main");
  let shape: Shape = "square";
  let card: CardContent | null = null;
  let picture = "";
  let file: File | null = null;
  let drawn = 0;

  function render(): void {
    if (card === null) return;
    const layout = layoutOf(shape);
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    const ticket = (drawn += 1);
    file = null;
    for (const button of buttonsIn(root, "[data-shape]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.shape === shape),
      );
    if (context === null) {
      picture = "";
      image.hidden = true;
      download.disabled = true;
      send.disabled = true;
      hint.textContent = "This browser could not draw the card.";
      return;
    }
    drawPoster(context, layout, card);
    picture = canvas.toDataURL("image/png");
    image.src = picture;
    image.alt = card.alt;
    image.hidden = false;
    download.disabled = false;
    send.disabled = false;
    hint.textContent = saveHint;
    const place = (name: string, part: number, whole: number): void =>
      holo.style.setProperty(name, `${String((part / whole) * 100)}%`);
    place("--card-left", layout.card.x, layout.width);
    place("--card-top", layout.card.y, layout.height);
    place("--card-width", layout.card.width, layout.width);
    place("--card-height", layout.card.height, layout.height);
    const named = fileNameOf(shape);
    canvas.toBlob((blob) => {
      if (blob !== null && ticket === drawn)
        file = new File([blob], named, { type: "image/png" });
    }, "image/png");
  }

  function close(): void {
    if (root.hidden) return;
    root.hidden = true;
    main?.removeAttribute("inert");
    onClosed();
  }

  function save(): void {
    if (picture === "") return;
    const anchor = document.createElement("a");
    anchor.href = picture;
    anchor.download = fileNameOf(shape);
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    hint.textContent = savedHint;
  }

  async function share(): Promise<void> {
    if (card === null) return;
    const data: ShareData = {
      text: card.shareText,
      title: "Pocket Dragon: Glitchy's Quest",
      ...(file === null ? {} : { files: [file] }),
    };
    if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
      hint.textContent = noShare;
      return;
    }
    try {
      await navigator.share(data);
      hint.textContent = "Shared! Thanks for spreading the word.";
    } catch (error) {
      hint.textContent =
        error instanceof DOMException && error.name === "AbortError"
          ? saveHint
          : noShare;
    }
  }

  async function copyLink(): Promise<void> {
    const link = card?.link ?? null;
    if (link === null) return;
    try {
      await navigator.clipboard.writeText(link);
      hint.textContent = "Invite link copied.";
    } catch {
      linkField.focus();
      linkField.select();
      hint.textContent = "Press Ctrl+C (or Cmd+C) to copy the invite link.";
    }
  }

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === root) close();
    const picked = shapes.find(
      (name) =>
        name === target?.closest("[data-shape]")?.getAttribute("data-shape"),
    );
    if (picked !== undefined && picked !== shape) {
      shape = picked;
      render();
    }
  });
  // Keys pressed in the panel are the panel's: the game's keys must not take them (and stop a button being pressed).
  const ownKeys = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.type === "keydown" && event.key === "Escape") close();
  };
  root.addEventListener("keydown", ownKeys);
  root.addEventListener("keyup", ownKeys);
  download.addEventListener("click", save);
  send.addEventListener("click", () => void share());
  copy.addEventListener("click", () => void copyLink());
  shut.addEventListener("click", close);
  send.hidden = typeof navigator.share !== "function";

  return {
    close,
    isOpen: () => !root.hidden,
    open(facts) {
      card = cardOf(facts);
      linkField.value = card.link ?? "";
      linkRow.hidden = card.link === null;
      copy.hidden = card.link === null;
      root.hidden = false;
      main?.setAttribute("inert", "");
      render();
      buttonsIn(root, `[data-shape="${shape}"]`)[0]?.focus();
    },
    update(facts) {
      if (root.hidden) return;
      card = cardOf(facts);
      render();
    },
  };
}
