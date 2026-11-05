import { element } from "./elements.ts";

// The touch screen's two small menus. The levels button opens the chapter menu over the screen (with the player's card), as the page shows
// it beside the screen to a mouse; choosing closes it. The Bag button opens the backpack's three foods, and using one closes it again.
export interface TouchPanel {
  readonly closeMenu: () => void;
  readonly menuOpen: () => boolean;
}

export function attachTouchPanel(main: HTMLElement): TouchPanel {
  const menu = element("menu", "button");
  const picker = element("chapters", "nav");
  const bag = element("bag", "button");
  const foods = element("bag-items", "div");
  const setMenu = (open: boolean): void => {
    main.dataset.menu = open ? "open" : "";
    menu.setAttribute("aria-expanded", String(open));
  };
  const setBag = (open: boolean): void => {
    foods.hidden = !open;
    bag.setAttribute("aria-expanded", String(open));
  };
  menu.addEventListener("click", () => setMenu(main.dataset.menu !== "open"));
  picker.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button"))
      setMenu(false);
  });
  bag.addEventListener("click", () => setBag(foods.hidden));
  foods.addEventListener("click", () => setBag(false));
  return {
    closeMenu: () => setMenu(false),
    menuOpen: () => main.dataset.menu === "open",
  };
}
