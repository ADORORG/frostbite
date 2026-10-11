/* global document, fetch */
// Everything this game asks for is named relative to the page, so the same files work whether the game has a
// whole host or a path of one.
fetch("data/levels.json")
  .then((response) => response.json())
  .then((levels) => {
    document.getElementById("status").textContent =
      `Loaded ${String(levels.length)} levels.`;
  })
  .catch(() => {
    document.getElementById("status").textContent = "Levels failed to load.";
  });
