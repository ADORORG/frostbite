// FROST-BITE :: CONFETTI — 1000 particles, hotter on every consecutive win
(function () {
  const { useEffect, useRef, useState, useCallback } = React;

  const PALETTES = [
    ["#5df6ff", "#8effff", "#6fffb0", "#ffffff"], // heat 1 — ice
    ["#5df6ff", "#6fffb0", "#ffd24a", "#ffffff", "#a280ff"], // heat 2 — bright
    ["#ffd24a", "#ff6b35", "#ff2d9d", "#5df6ff", "#ffffff"], // heat 3 — hot
    ["#ff2d9d", "#ff6b35", "#ffd24a", "#ffffff", "#ff8a3d", "#a280ff"], // heat 4 — inferno
  ];

  function ConfettiBurst({ fire, streak, onDone }) {
    const ref = useRef(null);
    const P = useRef([]);
    const raf = useRef(null);
    const active = useRef(false);

    const launch = useCallback((n, heat) => {
      const c = ref.current;
      if (!c) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      c.style.width = innerWidth + "px";
      c.style.height = innerHeight + "px";
      const pal = PALETTES[Math.min(PALETTES.length - 1, heat)];
      const W = c.width,
        H = c.height;
      const parts = [];
      // three cannons — left, centre-up, right
      const guns = [
        { x: 0.04 * W, y: H * 0.92, a: -Math.PI * 0.32, spread: 0.5 },
        { x: 0.5 * W, y: H * 1.02, a: -Math.PI * 0.5, spread: 0.8 },
        { x: 0.96 * W, y: H * 0.92, a: -Math.PI * 0.68, spread: 0.5 },
      ];
      for (let i = 0; i < n; i++) {
        const g = guns[i % 3];
        const ang = g.a + (Math.random() - 0.5) * g.spread;
        const sp = (10 + Math.random() * 26) * dpr * (1 + heat * 0.16);
        parts.push({
          x: g.x + (Math.random() - 0.5) * 40 * dpr,
          y: g.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          g: (0.34 + Math.random() * 0.3) * dpr,
          w: (3 + Math.random() * 7) * dpr,
          h: (3 + Math.random() * 11) * dpr,
          rot: Math.random() * 7,
          vr: (Math.random() - 0.5) * 0.5,
          col: pal[(Math.random() * pal.length) | 0],
          life: 1,
          fade: 0.0035 + Math.random() * 0.005,
          shape:
            Math.random() < 0.18
              ? "circle"
              : Math.random() < 0.3
                ? "streamer"
                : "rect",
          sway: Math.random() * 6,
          swaySpd: 0.04 + Math.random() * 0.08,
        });
      }
      P.current = P.current.concat(parts);
      if (!active.current) {
        active.current = true;
        loop();
      }
    }, []);

    function loop() {
      const c = ref.current;
      if (!c) {
        active.current = false;
        return;
      }
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      const ps = P.current;
      for (const p of ps) {
        p.vy += p.g;
        p.vx *= 0.992;
        p.vy *= 0.994;
        p.sway += p.swaySpd;
        p.x += p.vx + Math.sin(p.sway) * 1.1;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.fade;
        if (p.life <= 0 || p.y > c.height + 40) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, 7);
          ctx.fill();
        } else if (p.shape === "streamer") {
          ctx.fillRect(-p.w / 4, -p.h * 1.6, p.w / 2, p.h * 3.2);
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      P.current = ps.filter((p) => p.life > 0 && p.y < c.height + 40);
      if (P.current.length) raf.current = requestAnimationFrame(loop);
      else {
        active.current = false;
        ctx.clearRect(0, 0, c.width, c.height);
        onDone && onDone();
      }
    }

    useEffect(() => {
      if (!fire) return;
      const heat = Math.min(3, Math.max(0, streak - 1));
      // 1000 base, scaling with the streak
      const n = 1000 + heat * 340;
      launch(n, heat);
      // a second wave for hot streaks
      if (heat >= 2) setTimeout(() => launch(420, heat), 260);
      if (heat >= 3) setTimeout(() => launch(520, heat), 520);
    }, [fire, streak, launch]);

    useEffect(() => () => cancelAnimationFrame(raf.current), []);
    return <canvas ref={ref} className="confetti-layer" />;
  }

  // streak banner — HEATING UP / ON FIRE / INFERNO
  const HEAT_LABELS = [
    null,
    { t: "NICE", c: "#6fffb0" },
    { t: "HEATING UP ▲", c: "#ffd24a" },
    { t: "ON FIRE ▲▲", c: "#ff6b35" },
    { t: "INFERNO ▲▲▲", c: "#ff2d9d" },
  ];
  function StreakBanner({ streak }) {
    if (streak < 1) return null;
    const h = HEAT_LABELS[Math.min(HEAT_LABELS.length - 1, streak)];
    if (!h) return null;
    return (
      <div className="streak-banner" style={{ "--sc": h.c }} key={streak}>
        <span className="sb-x">×{streak}</span>
        <span className="sb-t">{h.t}</span>
      </div>
    );
  }

  Object.assign(window, { ConfettiBurst, StreakBanner });
})();
