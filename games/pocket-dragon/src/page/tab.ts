import { element } from "./elements.ts";

// The tab in the bottom left corner of a touch screen: a handle that stays in sight and opens what the player may want just then (a mouse
// has the chapters beside the screen and the backpack's keys, so it is not shown there). Between runs it is Levels: the quest, the levels
// and the player's card over the screen; choosing one, or a tap beside them, closes it again. During a run where there is a backpack it is
// the Bag: its three foods slide out beside the handle, and using one slides them back. Both handles keep one place, so neither moves
// when the other takes over.
export interface Tab {
  readonly closeMenu: () => void;
  readonly menuOpen: () => boolean;
  // Which handle is offered: Levels between runs, the Bag during one that has a backpack, neither in the Sky Nursery.
  readonly offer: (running: boolean, backpack: boolean) => void;
}

export function attachTab(main: HTMLElement): Tab {
  const menu = element("menu", "button");
  const picker = element("chapters", "nav");
  const share = element("share", "button");
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
    const target = event.target instanceof Element ? event.target : null;
    if (target === picker || (target?.closest("button") ?? null) !== null)
      setMenu(false);
  });
  share.addEventListener("click", () => setMenu(false));
  bag.addEventListener("click", () => setBag(foods.hidden));
  foods.addEventListener("click", () => setBag(false));
  return {
    closeMenu: () => setMenu(false),
    menuOpen: () => main.dataset.menu === "open",
    offer(running, backpack) {
      menu.hidden = running;
      menu.disabled = running;
      bag.hidden = !running || !backpack;
      bag.disabled = bag.hidden;
      if (running) setMenu(false);
      if (bag.hidden) setBag(false);
    },
  };
}
