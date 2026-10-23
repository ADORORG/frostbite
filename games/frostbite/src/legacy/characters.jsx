// FROST-BITE :: characters — original pixel cast (frost wizard, quantum cat, miner, sat king)
(function () {
  // ---- THE FROST WIZARD :: keeper of the Subzero Core ----
  function FrostWizard({ size = 64, mood = "idle" }) {
    return (
      <svg
        viewBox="0 0 32 40"
        width={size}
        height={(size * 40) / 32}
        shapeRendering="crispEdges"
      >
        {/* hat */}
        <rect x="14" y="1" width="4" height="2" fill="#2e6bff" />
        <rect x="12" y="3" width="8" height="2" fill="#2e6bff" />
        <rect x="10" y="5" width="12" height="2" fill="#2456d6" />
        <rect x="8" y="7" width="16" height="2" fill="#2456d6" />
        <rect x="6" y="9" width="20" height="2" fill="#1b44ad" />
        {/* hat stars */}
        <rect x="15" y="4" width="1" height="1" fill="#ffd24a" />
        <rect x="12" y="7" width="1" height="1" fill="#5df6ff" />
        <rect x="19" y="8" width="1" height="1" fill="#ffd24a" />
        <rect x="9" y="10" width="1" height="1" fill="#5df6ff" />
        {/* hat brim */}
        <rect x="5" y="11" width="22" height="1" fill="#5df6ff" />
        {/* face */}
        <rect x="10" y="12" width="12" height="5" fill="#e8d5c0" />
        {/* eyes glow */}
        {mood === "cast" ? (
          <>
            <rect x="12" y="14" width="3" height="2" fill="#5df6ff" />
            <rect x="17" y="14" width="3" height="2" fill="#5df6ff" />
          </>
        ) : (
          <>
            <rect x="12" y="14" width="2" height="2" fill="#0b1226" />
            <rect x="18" y="14" width="2" height="2" fill="#0b1226" />
            <rect x="12" y="14" width="1" height="1" fill="#5df6ff" />
            <rect x="18" y="14" width="1" height="1" fill="#5df6ff" />
          </>
        )}
        {/* beard */}
        <rect x="9" y="17" width="14" height="3" fill="#f2f8ff" />
        <rect x="10" y="20" width="12" height="3" fill="#e4eefc" />
        <rect x="12" y="23" width="8" height="3" fill="#f2f8ff" />
        <rect x="14" y="26" width="4" height="2" fill="#e4eefc" />
        {/* robe */}
        <rect x="8" y="20" width="2" height="14" fill="#1b44ad" />
        <rect x="22" y="20" width="2" height="14" fill="#1b44ad" />
        <rect x="10" y="26" width="12" height="8" fill="#2456d6" />
        <rect x="11" y="30" width="10" height="4" fill="#2e6bff" />
        {/* rune sash */}
        <rect x="10" y="28" width="12" height="1" fill="#ffd24a" />
        {/* staff */}
        <rect x="26" y="10" width="2" height="24" fill="#7a5230" />
        <rect x="24" y="6" width="6" height="2" fill="#5df6ff" opacity="0.9" />
        <rect x="25" y="4" width="4" height="2" fill="#8effff" />
        <rect x="26" y="7" width="2" height="3" fill="#5df6ff" />
        {mood === "cast" && (
          <>
            <rect x="23" y="2" width="1" height="1" fill="#ffd24a" />
            <rect x="30" y="3" width="1" height="1" fill="#5df6ff" />
            <rect x="27" y="0" width="1" height="1" fill="#8effff" />
          </>
        )}
        {/* feet */}
        <rect x="10" y="34" width="4" height="2" fill="#0b1226" />
        <rect x="18" y="34" width="4" height="2" fill="#0b1226" />
      </svg>
    );
  }

  // ---- QUANTUM CAT :: exists in two states, referee of King of the SAT ----
  function QuantumCat({ size = 64, collapsed = false }) {
    const body = collapsed ? "#ff2d9d" : "#a280ff";
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className={collapsed ? "" : "qcat"}
      >
        {/* ears */}
        <rect x="6" y="4" width="2" height="4" fill={body} />
        <rect x="8" y="2" width="2" height="4" fill={body} />
        <rect x="22" y="4" width="2" height="4" fill={body} />
        <rect x="20" y="2" width="2" height="4" fill={body} />
        <rect x="8" y="4" width="1" height="2" fill="#ff8fc7" />
        <rect x="21" y="4" width="1" height="2" fill="#ff8fc7" />
        {/* head */}
        <rect x="7" y="7" width="16" height="11" fill={body} />
        <rect x="6" y="9" width="1" height="7" fill={body} />
        <rect x="23" y="9" width="1" height="7" fill={body} />
        {/* eyes — big glowing */}
        <rect x="10" y="10" width="4" height="4" fill="#0b1226" />
        <rect x="17" y="10" width="4" height="4" fill="#0b1226" />
        <rect x="11" y="11" width="2" height="2" fill="#5df6ff" />
        <rect x="18" y="11" width="2" height="2" fill="#5df6ff" />
        <rect x="11" y="11" width="1" height="1" fill="#fff" />
        <rect x="18" y="11" width="1" height="1" fill="#fff" />
        {/* nose + mouth */}
        <rect x="15" y="15" width="2" height="1" fill="#ff8fc7" />
        <rect x="13" y="16" width="2" height="1" fill="#0b1226" />
        <rect x="17" y="16" width="2" height="1" fill="#0b1226" />
        {/* whiskers */}
        <rect x="3" y="14" width="4" height="1" fill="#f2f8ff" opacity="0.8" />
        <rect x="3" y="16" width="4" height="1" fill="#f2f8ff" opacity="0.8" />
        <rect x="25" y="14" width="4" height="1" fill="#f2f8ff" opacity="0.8" />
        <rect x="25" y="16" width="4" height="1" fill="#f2f8ff" opacity="0.8" />
        {/* body */}
        <rect x="9" y="18" width="14" height="9" fill={body} />
        <rect
          x="11"
          y="20"
          width="10"
          height="6"
          fill="#f2f8ff"
          opacity="0.25"
        />
        {/* superposition marks */}
        <rect x="12" y="21" width="1" height="1" fill="#5df6ff" />
        <rect x="19" y="23" width="1" height="1" fill="#5df6ff" />
        <rect x="15" y="24" width="2" height="1" fill="#ffd24a" />
        {/* tail — probability wave */}
        <rect x="23" y="22" width="2" height="2" fill={body} />
        <rect x="25" y="20" width="2" height="2" fill={body} />
        <rect x="27" y="18" width="2" height="2" fill={body} opacity="0.75" />
        <rect x="29" y="16" width="2" height="2" fill={body} opacity="0.45" />
        {/* legs */}
        <rect x="10" y="27" width="3" height="3" fill={body} />
        <rect x="19" y="27" width="3" height="3" fill={body} />
        <rect x="10" y="30" width="3" height="1" fill="#0b1226" />
        <rect x="19" y="30" width="3" height="1" fill="#0b1226" />
      </svg>
    );
  }

  // ---- THE MINER :: diesel rig operator ----
  function DieselMiner({ size = 56, striking = false }) {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        shapeRendering="crispEdges"
      >
        {/* helmet */}
        <rect x="9" y="3" width="14" height="4" fill="#ffd24a" />
        <rect x="8" y="6" width="16" height="2" fill="#e0b02e" />
        <rect x="14" y="1" width="4" height="2" fill="#ffd24a" />
        {/* lamp */}
        <rect x="14" y="4" width="4" height="3" fill="#fff8d0" />
        <rect x="15" y="5" width="2" height="1" fill="#5df6ff" />
        {striking && (
          <rect
            x="12"
            y="4"
            width="8"
            height="3"
            fill="#fff8d0"
            opacity="0.4"
          />
        )}
        {/* face */}
        <rect x="10" y="8" width="12" height="6" fill="#c9a084" />
        <rect x="12" y="10" width="2" height="2" fill="#0b1226" />
        <rect x="18" y="10" width="2" height="2" fill="#0b1226" />
        <rect x="13" y="13" width="6" height="1" fill="#0b1226" />
        {/* soot */}
        <rect x="10" y="12" width="2" height="1" fill="#3a2f28" />
        <rect x="20" y="11" width="2" height="1" fill="#3a2f28" />
        {/* jacket */}
        <rect x="8" y="14" width="16" height="10" fill="#ff6b35" />
        <rect x="10" y="16" width="12" height="2" fill="#ffd24a" />
        <rect x="10" y="20" width="12" height="2" fill="#ffd24a" />
        <rect x="15" y="14" width="2" height="10" fill="#d4501e" />
        {/* arms */}
        <rect x="5" y="15" width="3" height="7" fill="#ff6b35" />
        <rect x="24" y="15" width="3" height="7" fill="#ff6b35" />
        {/* legs */}
        <rect x="10" y="24" width="5" height="6" fill="#2a3c70" />
        <rect x="17" y="24" width="5" height="6" fill="#2a3c70" />
        <rect x="9" y="30" width="6" height="2" fill="#0b1226" />
        <rect x="17" y="30" width="6" height="2" fill="#0b1226" />
        {/* pickaxe */}
        <rect x="27" y="10" width="2" height="14" fill="#7a5230" />
        <rect
          x="24"
          y={striking ? 20 : 8}
          width="8"
          height="2"
          fill="#aebed6"
        />
        <rect
          x="23"
          y={striking ? 21 : 9}
          width="2"
          height="2"
          fill="#8fa3bd"
        />
      </svg>
    );
  }

  // ---- SAT KING :: crowned pixel monarch ----
  function SatKing({ size = 56, color = "#ffd24a" }) {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        shapeRendering="crispEdges"
      >
        {/* crown */}
        <rect x="9" y="2" width="2" height="4" fill={color} />
        <rect x="15" y="1" width="2" height="5" fill={color} />
        <rect x="21" y="2" width="2" height="4" fill={color} />
        <rect x="9" y="6" width="14" height="2" fill={color} />
        <rect x="9" y="1" width="2" height="1" fill="#ff2d9d" />
        <rect x="15" y="0" width="2" height="1" fill="#5df6ff" />
        <rect x="21" y="1" width="2" height="1" fill="#6fffb0" />
        {/* head */}
        <rect x="10" y="8" width="12" height="7" fill="#e8d5c0" />
        <rect x="12" y="10" width="2" height="2" fill="#0b1226" />
        <rect x="18" y="10" width="2" height="2" fill="#0b1226" />
        <rect x="13" y="13" width="6" height="1" fill="#0b1226" />
        {/* cape + body */}
        <rect x="6" y="15" width="20" height="3" fill="#ff2d9d" />
        <rect x="8" y="18" width="16" height="9" fill="#2456d6" />
        <rect x="6" y="18" width="2" height="11" fill="#ff2d9d" />
        <rect x="24" y="18" width="2" height="11" fill="#ff2d9d" />
        {/* sat emblem */}
        <rect x="14" y="20" width="4" height="5" fill={color} />
        <rect x="15" y="19" width="2" height="1" fill={color} />
        <rect x="15" y="25" width="2" height="1" fill={color} />
        <rect x="13" y="21" width="6" height="1" fill="#2456d6" />
        <rect x="13" y="23" width="6" height="1" fill="#2456d6" />
        {/* legs */}
        <rect x="10" y="27" width="5" height="4" fill="#1a2750" />
        <rect x="17" y="27" width="5" height="4" fill="#1a2750" />
        <rect x="9" y="31" width="6" height="1" fill="#0b1226" />
        <rect x="17" y="31" width="6" height="1" fill="#0b1226" />
      </svg>
    );
  }

  // ---- $DOG ARMY SOLDIER :: moon-bound, helmeted, extremely normal about it ----
  function DogSoldier({ size = 56, rank = 0, barking = false }) {
    // rank 0=pup 1=sergeant 2=general — helmet/medals scale up
    const coat = ["#e8a33d", "#f5b953", "#ffd24a"][rank] || "#e8a33d";
    const dark = ["#b8792a", "#c98f30", "#e0b02e"][rank] || "#b8792a";
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        shapeRendering="crispEdges"
      >
        {/* helmet */}
        <rect x="8" y="3" width="16" height="3" fill="#4a5f3a" />
        <rect x="7" y="5" width="18" height="2" fill="#3d5030" />
        <rect x="14" y="1" width="4" height="2" fill="#4a5f3a" />
        {rank > 0 && <rect x="15" y="1" width="2" height="1" fill="#ffd24a" />}
        {/* moon patch on helmet */}
        <rect x="9" y="4" width="2" height="2" fill="#f2f8ff" />
        {/* ears */}
        <rect x="5" y="7" width="3" height="6" fill={dark} />
        <rect x="24" y="7" width="3" height="6" fill={dark} />
        <rect x="6" y="8" width="1" height="3" fill="#ff8fc7" />
        <rect x="25" y="8" width="1" height="3" fill="#ff8fc7" />
        {/* head */}
        <rect x="8" y="7" width="16" height="10" fill={coat} />
        <rect x="10" y="13" width="12" height="5" fill="#f7e6c8" />
        {/* eyes */}
        <rect x="11" y="10" width="3" height="3" fill="#0b1226" />
        <rect x="18" y="10" width="3" height="3" fill="#0b1226" />
        <rect x="12" y="10" width="1" height="1" fill="#fff" />
        <rect x="19" y="10" width="1" height="1" fill="#fff" />
        {/* snout */}
        <rect x="14" y="15" width="4" height="3" fill="#0b1226" />
        {barking ? (
          <>
            <rect x="13" y="18" width="6" height="3" fill="#8a1f3d" />
            <rect x="14" y="19" width="4" height="2" fill="#ff5d8f" />
          </>
        ) : (
          <rect x="14" y="18" width="4" height="1" fill="#0b1226" />
        )}
        {/* body + flak vest */}
        <rect x="9" y="19" width="14" height="8" fill={coat} />
        <rect x="10" y="20" width="12" height="6" fill="#4a5f3a" />
        <rect x="11" y="21" width="3" height="2" fill="#ffd24a" />
        {rank > 0 && <rect x="15" y="21" width="2" height="2" fill="#ff2d9d" />}
        {rank > 1 && <rect x="18" y="21" width="3" height="2" fill="#5df6ff" />}
        {/* tail — wagging */}
        <rect x="23" y="20" width="3" height="2" fill={dark} />
        <rect x="26" y="17" width="2" height="3" fill={dark} />
        <rect x="27" y="15" width="2" height="2" fill={coat} />
        {/* legs */}
        <rect x="10" y="27" width="4" height="4" fill={coat} />
        <rect x="18" y="27" width="4" height="4" fill={coat} />
        <rect x="9" y="31" width="5" height="1" fill="#0b1226" />
        <rect x="18" y="31" width="5" height="1" fill="#0b1226" />
      </svg>
    );
  }

  // ---- BONE :: the fetch token ----
  function Bone({ size = 28 }) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        shapeRendering="crispEdges"
      >
        <g fill="#f7f2e0">
          <rect x="3" y="7" width="4" height="4" />
          <rect x="3" y="13" width="4" height="4" />
          <rect x="17" y="7" width="4" height="4" />
          <rect x="17" y="13" width="4" height="4" />
          <rect x="6" y="10" width="12" height="4" />
          <rect x="5" y="9" width="3" height="6" />
          <rect x="16" y="9" width="3" height="6" />
        </g>
        <g fill="#c9c0a5">
          <rect x="6" y="13" width="12" height="1" />
          <rect x="3" y="16" width="4" height="1" />
          <rect x="17" y="16" width="4" height="1" />
        </g>
      </svg>
    );
  }

  // ---- ALKANE CAPTAIN :: black-hooded keeper of the envelope ----
  function AlkaneCaptain({ size = 64, mood = "idle" }) {
    return (
      <svg
        viewBox="0 0 32 40"
        width={size}
        height={(size * 40) / 32}
        shapeRendering="crispEdges"
      >
        {/* hood outer */}
        <rect x="10" y="2" width="12" height="2" fill="#0a0d16" />
        <rect x="8" y="4" width="16" height="3" fill="#0a0d16" />
        <rect x="6" y="7" width="20" height="10" fill="#0a0d16" />
        <rect x="5" y="10" width="1" height="8" fill="#05070d" />
        <rect x="26" y="10" width="1" height="8" fill="#05070d" />
        {/* hood rim highlight */}
        <rect x="8" y="4" width="16" height="1" fill="#1e2a44" />
        <rect x="6" y="7" width="1" height="9" fill="#1e2a44" />
        {/* void face */}
        <rect x="9" y="8" width="14" height="9" fill="#02040a" />
        {/* glowing eyes */}
        <rect x="11" y="11" width="3" height="2" fill="#5df6ff" />
        <rect x="18" y="11" width="3" height="2" fill="#5df6ff" />
        <rect x="12" y="11" width="1" height="1" fill="#fff" />
        <rect x="19" y="11" width="1" height="1" fill="#fff" />
        {mood === "cast" && (
          <>
            <rect
              x="10"
              y="10"
              width="5"
              height="4"
              fill="#5df6ff"
              opacity="0.28"
            />
            <rect
              x="17"
              y="10"
              width="5"
              height="4"
              fill="#5df6ff"
              opacity="0.28"
            />
          </>
        )}
        {/* cloak body */}
        <rect x="7" y="17" width="18" height="15" fill="#0a0d16" />
        <rect x="5" y="19" width="2" height="13" fill="#05070d" />
        <rect x="25" y="19" width="2" height="13" fill="#05070d" />
        {/* cloak inner glow seam */}
        <rect x="15" y="17" width="2" height="15" fill="#101a36" />
        {/* clasp */}
        <rect x="14" y="18" width="4" height="3" fill="#5df6ff" />
        <rect x="15" y="19" width="2" height="1" fill="#02040a" />
        {/* UTXO sigil held aloft */}
        <rect
          x="1"
          y="14"
          width="6"
          height="6"
          fill="none"
          stroke="#5df6ff"
          strokeWidth="1"
        />
        <rect x="3" y="16" width="2" height="2" fill="#5df6ff" />
        <rect x="3" y="20" width="2" height="3" fill="#1e2a44" />
        {/* hem tatters */}
        <rect x="7" y="32" width="3" height="3" fill="#0a0d16" />
        <rect x="12" y="32" width="3" height="4" fill="#0a0d16" />
        <rect x="17" y="32" width="3" height="3" fill="#0a0d16" />
        <rect x="21" y="32" width="3" height="4" fill="#0a0d16" />
        {/* floor glow */}
        <rect
          x="8"
          y="37"
          width="16"
          height="1"
          fill="#5df6ff"
          opacity="0.35"
        />
      </svg>
    );
  }

  // ---- MR. FROST :: dapper ice gentleman, terrifyingly polite ----
  function MrFrost({ size = 64 }) {
    return (
      <svg
        viewBox="0 0 32 40"
        width={size}
        height={(size * 40) / 32}
        shapeRendering="crispEdges"
      >
        {/* top hat */}
        <rect x="10" y="1" width="12" height="8" fill="#0b1226" />
        <rect x="10" y="6" width="12" height="2" fill="#5df6ff" />
        <rect x="7" y="9" width="18" height="2" fill="#0b1226" />
        <rect x="11" y="2" width="2" height="5" fill="#1a2750" />
        {/* head — ice sphere */}
        <rect x="10" y="11" width="12" height="10" fill="#dff2ff" />
        <rect x="9" y="13" width="1" height="6" fill="#b8dcf0" />
        <rect x="22" y="13" width="1" height="6" fill="#b8dcf0" />
        <rect x="11" y="12" width="4" height="3" fill="#fff" opacity="0.85" />
        {/* monocle */}
        <rect
          x="17"
          y="14"
          width="5"
          height="5"
          fill="none"
          stroke="#ffd24a"
          strokeWidth="1"
        />
        <rect x="18" y="15" width="3" height="3" fill="#5df6ff" opacity="0.4" />
        <rect x="19" y="16" width="1" height="1" fill="#0b1226" />
        <rect x="22" y="19" width="1" height="3" fill="#ffd24a" />
        {/* left eye — coal */}
        <rect x="12" y="15" width="2" height="2" fill="#0b1226" />
        {/* carrot nose */}
        <rect x="15" y="17" width="3" height="2" fill="#ff6b35" />
        <rect x="18" y="17" width="1" height="1" fill="#d4501e" />
        {/* coal smirk */}
        <rect x="12" y="19" width="1" height="1" fill="#0b1226" />
        <rect x="14" y="20" width="1" height="1" fill="#0b1226" />
        <rect x="16" y="20" width="1" height="1" fill="#0b1226" />
        <rect x="18" y="19" width="1" height="1" fill="#0b1226" />
        {/* bow tie */}
        <rect x="13" y="21" width="2" height="3" fill="#ff2d9d" />
        <rect x="17" y="21" width="2" height="3" fill="#ff2d9d" />
        <rect x="15" y="22" width="2" height="1" fill="#c91c7a" />
        {/* tailcoat */}
        <rect x="9" y="22" width="14" height="11" fill="#101a36" />
        <rect x="7" y="23" width="2" height="10" fill="#0b1226" />
        <rect x="23" y="23" width="2" height="10" fill="#0b1226" />
        {/* shirt front */}
        <rect x="14" y="24" width="4" height="7" fill="#eef7ff" />
        <rect x="15" y="26" width="1" height="1" fill="#5df6ff" />
        <rect x="15" y="29" width="1" height="1" fill="#5df6ff" />
        {/* tails */}
        <rect x="9" y="33" width="4" height="4" fill="#101a36" />
        <rect x="19" y="33" width="4" height="4" fill="#101a36" />
        {/* cane */}
        <rect x="27" y="16" width="2" height="20" fill="#5df6ff" />
        <rect x="25" y="14" width="4" height="2" fill="#ffd24a" />
        {/* spats */}
        <rect x="11" y="37" width="4" height="2" fill="#dff2ff" />
        <rect x="17" y="37" width="4" height="2" fill="#dff2ff" />
      </svg>
    );
  }

  // ---- LT. DANNI DIESEL :: field engineer, keeps the rigs turning ----
  function LtDanniDiesel({ size = 64 }) {
    return (
      <svg
        viewBox="0 0 32 40"
        width={size}
        height={(size * 40) / 32}
        shapeRendering="crispEdges"
      >
        {/* hair back */}
        <rect x="8" y="5" width="16" height="12" fill="#8a3b1f" />
        {/* ponytail */}
        <rect x="24" y="9" width="3" height="8" fill="#8a3b1f" />
        <rect x="25" y="15" width="3" height="6" fill="#a04a26" />
        <rect x="26" y="20" width="2" height="3" fill="#8a3b1f" />
        <rect x="23" y="8" width="2" height="2" fill="#ff2d9d" />
        {/* goggles on forehead */}
        <rect x="8" y="6" width="16" height="3" fill="#2a3c70" />
        <rect x="10" y="6" width="4" height="3" fill="#5df6ff" />
        <rect x="17" y="6" width="4" height="3" fill="#5df6ff" />
        <rect x="11" y="7" width="1" height="1" fill="#fff" />
        <rect x="18" y="7" width="1" height="1" fill="#fff" />
        {/* face */}
        <rect x="10" y="10" width="12" height="9" fill="#e0a878" />
        <rect x="12" y="13" width="2" height="2" fill="#0b1226" />
        <rect x="18" y="13" width="2" height="2" fill="#0b1226" />
        <rect x="12" y="13" width="1" height="1" fill="#5df6ff" />
        <rect x="18" y="13" width="1" height="1" fill="#5df6ff" />
        {/* grease smudge */}
        <rect x="20" y="16" width="2" height="1" fill="#4a3a30" />
        {/* grin */}
        <rect x="13" y="17" width="6" height="1" fill="#0b1226" />
        <rect x="19" y="16" width="1" height="1" fill="#0b1226" />
        {/* jumpsuit */}
        <rect x="8" y="19" width="16" height="13" fill="#ff6b35" />
        <rect x="9" y="21" width="14" height="2" fill="#ffd24a" />
        <rect x="9" y="27" width="14" height="2" fill="#ffd24a" />
        {/* collar */}
        <rect x="12" y="19" width="8" height="2" fill="#d4501e" />
        {/* rank pips */}
        <rect x="10" y="24" width="2" height="2" fill="#5df6ff" />
        <rect x="13" y="24" width="2" height="2" fill="#5df6ff" />
        {/* arms */}
        <rect x="5" y="20" width="3" height="9" fill="#ff6b35" />
        <rect x="24" y="20" width="3" height="9" fill="#ff6b35" />
        <rect x="5" y="29" width="3" height="2" fill="#e0a878" />
        {/* wrench in right hand */}
        <rect x="25" y="29" width="2" height="8" fill="#aebed6" />
        <rect x="24" y="27" width="4" height="2" fill="#8fa3bd" />
        <rect x="24" y="26" width="1" height="1" fill="#8fa3bd" />
        <rect x="27" y="26" width="1" height="1" fill="#8fa3bd" />
        {/* legs */}
        <rect x="9" y="32" width="5" height="5" fill="#2a3c70" />
        <rect x="18" y="32" width="5" height="5" fill="#2a3c70" />
        <rect x="8" y="37" width="7" height="2" fill="#0b1226" />
        <rect x="17" y="37" width="7" height="2" fill="#0b1226" />
      </svg>
    );
  }

  // ---- Dialogue row ----
  function CharSay({ who, children }) {
    const cast =
      {
        wizard: {
          Art: FrostWizard,
          name: "THE FROST WIZARD",
          color: "#5df6ff",
        },
        cat: { Art: QuantumCat, name: "QUANTUM CAT", color: "#a280ff" },
        miner: { Art: DieselMiner, name: "RIG OPERATOR", color: "#ff6b35" },
        king: { Art: SatKing, name: "THE SAT KING", color: "#ffd24a" },
        dog: { Art: DogSoldier, name: "$DOG ARMY", color: "#ffd24a" },
        captain: {
          Art: AlkaneCaptain,
          name: "THE ALKANE CAPTAIN",
          color: "#8effff",
        },
        frost: { Art: MrFrost, name: "MR. FROST", color: "#dff2ff" },
        danni: {
          Art: LtDanniDiesel,
          name: "LT. DANNI DIESEL",
          color: "#ff6b35",
        },
      }[who] || {};
    const Art = cast.Art;
    return (
      <div className="char-row">
        <div style={{ flexShrink: 0 }}>
          <Art size={44} />
        </div>
        <div>
          <div className="char-who" style={{ color: cast.color }}>
            {cast.name}
          </div>
          <div className="char-say">{children}</div>
        </div>
      </div>
    );
  }

  Object.assign(window, {
    FrostWizard,
    QuantumCat,
    DieselMiner,
    SatKing,
    DogSoldier,
    AlkaneCaptain,
    MrFrost,
    LtDanniDiesel,
    Bone,
    CharSay,
  });
})();
