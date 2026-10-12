// The game's code, loaded in the order the original page loaded it. Each file keeps what it shares in
// `window` (its own `Object.assign(window, ...)`), so order is what makes a name exist when a later file asks for
// it. `app.jsx` is last: it mounts the game. Legacy files, copied from the pre-platform game (src/legacy/README.md).
import "./legacy/tweaks-panel.jsx";
import "./legacy/telemetry.jsx";
import "./legacy/alkanes.jsx";
import "./legacy/characters.jsx";
import "./legacy/minigames.jsx";
import "./legacy/games9.jsx";
import "./legacy/games9b.jsx";
import "./legacy/audio.jsx";
import "./legacy/confetti.jsx";
import "./legacy/satbag.jsx";
import "./legacy/pops.jsx";
import "./legacy/burn.jsx";
import "./legacy/dogmode.jsx";
import "./legacy/progression.jsx";
import "./legacy/components.jsx";
import "./legacy/kingofsat.jsx";
import "./legacy/crew.jsx";
import "./legacy/cinematic.jsx";
import "./legacy/companion.jsx";
import "./legacy/subzero.jsx";
import "./legacy/minercraft.jsx";
import "./legacy/fortress.jsx";
import "./legacy/satoshi.jsx";
import "./legacy/tutorial.jsx";
import "./legacy/wallet.jsx";
import "./legacy/app.jsx";
