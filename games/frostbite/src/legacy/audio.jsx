// FROST-BITE :: AUDIO — 9 synth tracks + arcade SFX, zero assets
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  let AC = null;
  const ac = () => {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    return AC;
  };
  const N = {
    C: 261.63,
    Cs: 277.18,
    D: 293.66,
    Ds: 311.13,
    E: 329.63,
    F: 349.23,
    Fs: 369.99,
    G: 392,
    Gs: 415.3,
    A: 440,
    As: 466.16,
    B: 493.88,
  };
  const hz = (n, o = 0) => (N[n] || 440) * Math.pow(2, o);

  // ---------- SFX ----------
  function blip({
    f = 440,
    to,
    type = "square",
    dur = 0.1,
    vol = 0.18,
    at = 0.004,
    curve,
  }) {
    try {
      const c = ac(),
        o = c.createOscillator(),
        g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      if (to)
        o.frequency[
          curve === "exp"
            ? "exponentialRampToValueAtTime"
            : "linearRampToValueAtTime"
        ](Math.max(1, to), c.currentTime + dur);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(vol, c.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g);
      g.connect(SFX_BUS || c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    } catch (e) {}
  }
  function noise({ dur = 0.2, vol = 0.14, hp = 400 }) {
    try {
      const c = ac(),
        len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate),
        d = buf.getChannelData(0);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource();
      s.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = hp;
      const g = c.createGain();
      g.gain.value = vol;
      s.connect(f);
      f.connect(g);
      g.connect(SFX_BUS || c.destination);
      s.start();
    } catch (e) {}
  }
  let SFX_BUS = null,
    MUS_BUS = null;
  function buses() {
    const c = ac();
    if (!SFX_BUS) {
      SFX_BUS = c.createGain();
      SFX_BUS.gain.value = 0.8;
      SFX_BUS.connect(c.destination);
    }
    if (!MUS_BUS) {
      MUS_BUS = c.createGain();
      MUS_BUS.gain.value = 0.35;
      MUS_BUS.connect(c.destination);
    }
  }

  const SFX = {
    click: () =>
      blip({ f: 900, to: 1400, dur: 0.05, vol: 0.1, type: "square" }),
    pick: () => {
      blip({ f: 660, to: 990, dur: 0.08, vol: 0.13 });
    },
    correct: () => {
      blip({ f: hz("E"), dur: 0.09, vol: 0.15 });
      setTimeout(() => blip({ f: hz("G"), dur: 0.09, vol: 0.15 }), 70);
      setTimeout(() => blip({ f: hz("C", 1), dur: 0.14, vol: 0.16 }), 140);
    },
    win: () => {
      [
        ["C", 0],
        ["E", 0],
        ["G", 0],
        ["C", 1],
        ["E", 1],
      ].forEach(([n, o], i) =>
        setTimeout(
          () => blip({ f: hz(n, o), dur: 0.2, vol: 0.18, type: "square" }),
          i * 85,
        ),
      );
    },
    jackpot: () => {
      [
        ["G", 0],
        ["C", 1],
        ["E", 1],
        ["G", 1],
        ["C", 2],
      ].forEach(([n, o], i) =>
        setTimeout(() => {
          blip({ f: hz(n, o), dur: 0.28, vol: 0.2, type: "square" });
          blip({ f: hz(n, o) * 1.5, dur: 0.28, vol: 0.08, type: "triangle" });
        }, i * 90),
      );
    },
    lose: () => {
      blip({
        f: 320,
        to: 70,
        dur: 0.5,
        vol: 0.2,
        type: "sawtooth",
        curve: "exp",
      });
      noise({ dur: 0.3, vol: 0.1, hp: 200 });
    },
    bust: () => {
      noise({ dur: 0.34, vol: 0.2, hp: 120 });
      blip({
        f: 180,
        to: 44,
        dur: 0.42,
        vol: 0.2,
        type: "square",
        curve: "exp",
      });
    },
    zap: () => {
      blip({
        f: 1800,
        to: 240,
        dur: 0.13,
        vol: 0.13,
        type: "sawtooth",
        curve: "exp",
      });
    },
    jump: () => blip({ f: 420, to: 880, dur: 0.12, vol: 0.12, type: "square" }),
    land: () =>
      blip({ f: 220, to: 130, dur: 0.09, vol: 0.1, type: "triangle" }),
    coin: () => {
      blip({ f: hz("B", 1), dur: 0.06, vol: 0.14 });
      setTimeout(() => blip({ f: hz("E", 2), dur: 0.16, vol: 0.14 }), 55);
    },
    approach: () => {
      blip({ f: 300, to: 460, dur: 0.3, vol: 0.1, type: "triangle" });
      setTimeout(
        () => blip({ f: 300, to: 460, dur: 0.3, vol: 0.1, type: "triangle" }),
        340,
      );
    },
    heat: () => {
      blip({ f: 200, to: 900, dur: 0.5, vol: 0.12, type: "sawtooth" });
      noise({ dur: 0.4, vol: 0.06, hp: 900 });
    },
    defrost: () => {
      noise({ dur: 0.6, vol: 0.1, hp: 2200 });
      blip({
        f: 1300,
        to: 380,
        dur: 0.5,
        vol: 0.09,
        type: "sine",
        curve: "exp",
      });
    },
    block: () => {
      blip({ f: hz("C", 1), dur: 0.18, vol: 0.16, type: "square" });
      setTimeout(
        () => blip({ f: hz("G"), dur: 0.22, vol: 0.14, type: "square" }),
        150,
      );
    },
    open: () =>
      blip({ f: 520, to: 1040, dur: 0.16, vol: 0.1, type: "triangle" }),
    close: () =>
      blip({ f: 1040, to: 420, dur: 0.14, vol: 0.09, type: "triangle" }),
    bark: () => {
      blip({ f: 380, to: 180, dur: 0.11, vol: 0.18, type: "sawtooth" });
      setTimeout(
        () => blip({ f: 300, to: 150, dur: 0.1, vol: 0.14, type: "sawtooth" }),
        110,
      );
    },
    levelup: () => {
      [0, 1, 2, 3].forEach((i) =>
        setTimeout(
          () => blip({ f: hz("C") * Math.pow(1.26, i), dur: 0.16, vol: 0.16 }),
          i * 70,
        ),
      );
    },
    error: () => {
      blip({ f: 240, dur: 0.1, vol: 0.16, type: "square" });
      setTimeout(
        () => blip({ f: 200, dur: 0.18, vol: 0.16, type: "square" }),
        110,
      );
    },
  };

  // ---------- 9 TRACKS ----------
  // each: {name, bpm, key root, bass[], lead[], drums pattern}
  const _ = null;
  const TRACKS = [
    {
      id: 0,
      name: "FROSTLINE",
      bpm: 112,
      mood: "the lobby loop",
      bass: ["C", "C", "G", "G", "As", "As", "F", "F"],
      lead: [
        "E",
        "G",
        "C1",
        "B",
        "G",
        "E",
        "D",
        "E",
        "F",
        "A",
        "C1",
        "A",
        "G",
        "E",
        "D",
        "C",
      ],
      kick: "x..x..x.",
      hat: "..x...x.",
    },
    {
      id: 1,
      name: "BLOCK PRESSURE",
      bpm: 128,
      mood: "the clock is filling",
      bass: ["A", "A", "A", "C1", "G", "G", "G", "As"],
      lead: [
        "A",
        "C1",
        "E1",
        "C1",
        "A",
        "G",
        "E",
        "G",
        "F",
        "A",
        "D1",
        "A",
        "E",
        "G",
        "C1",
        "G",
      ],
      kick: "x.x.x.x.",
      hat: "x.x.x.x.",
    },
    {
      id: 2,
      name: "DIESEL RUN",
      bpm: 140,
      mood: "the rigs are turning",
      bass: ["E", "E", "G", "A", "E", "E", "D", "C"],
      lead: [
        "E1",
        "D1",
        "B",
        "A",
        "G",
        "A",
        "B",
        "D1",
        "E1",
        "G1",
        "E1",
        "D1",
        "B",
        "A",
        "G",
        "E",
      ],
      kick: "x..x.x..",
      hat: "xxxxxxxx",
    },
    {
      id: 3,
      name: "TOUCH GRASS",
      bpm: 84,
      mood: "cooldown, breathe",
      bass: ["F", "F", "C", "C", "G", "G", "As", "As"],
      lead: [
        "C1",
        "A",
        "F",
        "A",
        "C1",
        "D1",
        "C1",
        "A",
        "As",
        "G",
        "D",
        "G",
        "As",
        "C1",
        "As",
        "G",
      ],
      kick: "x.......",
      hat: "....x...",
    },
    {
      id: 4,
      name: "SQUIRREL!",
      bpm: 152,
      mood: "dog mode, no brakes",
      bass: ["G", "G", "G", "G", "E", "E", "F", "F"],
      lead: [
        "G1",
        "G1",
        "E1",
        "G1",
        "C1",
        "E1",
        "G1",
        "B",
        "A",
        "A",
        "F1",
        "A",
        "D1",
        "F1",
        "A",
        "C1",
      ],
      kick: "xxx.xxx.",
      hat: "x.xxx.xx",
    },
    {
      id: 5,
      name: "FIRE FALLS",
      bpm: 136,
      mood: "burnout lane",
      bass: ["D", "D", "F", "F", "As", "As", "C", "C"],
      lead: [
        "D1",
        "F1",
        "A1",
        "F1",
        "D1",
        "C1",
        "As",
        "C1",
        "D1",
        "As",
        "G",
        "As",
        "F",
        "D",
        "C",
        "D",
      ],
      kick: "x.xx.x.x",
      hat: "xx.xxx.x",
    },
    {
      id: 6,
      name: "DRIFT",
      bpm: 92,
      mood: "air mode, weightless",
      bass: ["A", "A", "E", "E", "F", "F", "C", "C"],
      lead: [
        "E1",
        "A",
        "B",
        "C1",
        "E1",
        "D1",
        "B",
        "A",
        "F",
        "A",
        "C1",
        "E1",
        "D1",
        "C1",
        "A",
        "G",
      ],
      kick: "x...x...",
      hat: "..x...x.",
    },
    {
      id: 7,
      name: "LACTOSE",
      bpm: 120,
      mood: "cheese, unexplained",
      bass: ["As", "As", "F", "G", "As", "C1", "F", "D"],
      lead: [
        "D1",
        "F1",
        "D1",
        "C1",
        "As",
        "C1",
        "D1",
        "F1",
        "G",
        "As",
        "G",
        "F",
        "D",
        "F",
        "G",
        "As",
      ],
      kick: "x..x.x.x",
      hat: ".x.x.x.x",
    },
    {
      id: 8,
      name: "SUBZERO CORE",
      bpm: 104,
      mood: "the mountain",
      bass: ["C", "C", "Ds", "Ds", "G", "G", "As", "As"],
      lead: [
        "G",
        "As",
        "D1",
        "As",
        "G",
        "F",
        "Ds",
        "F",
        "C1",
        "Ds1",
        "G1",
        "Ds1",
        "C1",
        "As",
        "G",
        "As",
      ],
      kick: "x..x..x.",
      hat: "....x...",
    },
    {
      id: 9,
      name: "COLD OPEN",
      bpm: 76,
      mood: "cinematic · the cold open",
      bass: ["C", "C", "C", "C", "Gs", "Gs", "As", "As"],
      lead: [
        "C1",
        _,
        "Ds1",
        _,
        "G1",
        _,
        "Ds1",
        _,
        "As",
        _,
        "D1",
        _,
        "F1",
        _,
        "D1",
        _,
      ],
      kick: "x.......",
      hat: "..x...x.",
    },
  ];

  function useAudio() {
    const [on, setOn] = useState(false);
    const [musicOn, setMusicOn] = useState(true);
    const [sfxOn, setSfxOn] = useState(true);
    const [track, setTrack] = useState(0);
    const [vol, setVol] = useState(0.35);
    const [sfxVol, setSfxVol] = useState(0.8);
    const step = useRef(0);
    const timer = useRef(null);

    useEffect(() => {
      if (on) buses();
    }, [on]);
    useEffect(() => {
      if (MUS_BUS) MUS_BUS.gain.value = musicOn && on ? vol : 0;
    }, [vol, musicOn, on]);
    useEffect(() => {
      if (SFX_BUS) SFX_BUS.gain.value = sfxOn && on ? sfxVol : 0;
    }, [sfxVol, sfxOn, on]);

    // sequencer
    useEffect(() => {
      if (!on || !musicOn) {
        clearInterval(timer.current);
        return;
      }
      buses();
      const t = TRACKS[track];
      const spb = 60000 / t.bpm / 2; // 8th notes
      step.current = 0;
      timer.current = setInterval(() => {
        const c = ac();
        if (!c) return;
        const s = step.current++;
        const bar = s % 16;
        // bass
        if (bar % 2 === 0) {
          const n = t.bass[(bar / 2) % t.bass.length];
          try {
            const o = c.createOscillator(),
              g = c.createGain();
            o.type = "triangle";
            o.frequency.value = hz(n, -1);
            g.gain.setValueAtTime(0, c.currentTime);
            g.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.01);
            g.gain.exponentialRampToValueAtTime(
              0.001,
              c.currentTime + (spb / 1000) * 1.7,
            );
            o.connect(g);
            g.connect(MUS_BUS);
            o.start();
            o.stop(c.currentTime + (spb / 1000) * 2);
          } catch (e) {}
        }
        // lead
        const ln = t.lead[s % t.lead.length];
        if (ln) {
          const oct = ln.endsWith("1") ? 1 : ln.endsWith("2") ? 2 : 0;
          const name = ln.replace(/[12]$/, "");
          try {
            const o = c.createOscillator(),
              g = c.createGain();
            o.type = "square";
            o.frequency.value = hz(name, oct);
            g.gain.setValueAtTime(0, c.currentTime);
            g.gain.linearRampToValueAtTime(0.13, c.currentTime + 0.008);
            g.gain.exponentialRampToValueAtTime(
              0.001,
              c.currentTime + (spb / 1000) * 0.85,
            );
            o.connect(g);
            g.connect(MUS_BUS);
            o.start();
            o.stop(c.currentTime + spb / 1000);
          } catch (e) {}
        }
        // drums
        if (t.kick[bar % 8] === "x") {
          try {
            const o = c.createOscillator(),
              g = c.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(150, c.currentTime);
            o.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.12);
            g.gain.setValueAtTime(0.5, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
            o.connect(g);
            g.connect(MUS_BUS);
            o.start();
            o.stop(c.currentTime + 0.16);
          } catch (e) {}
        }
        if (t.hat[bar % 8] === "x") {
          try {
            const len = Math.floor(c.sampleRate * 0.03);
            const buf = c.createBuffer(1, len, c.sampleRate),
              d = buf.getChannelData(0);
            for (let i = 0; i < len; i++)
              d[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const sn = c.createBufferSource();
            sn.buffer = buf;
            const f = c.createBiquadFilter();
            f.type = "highpass";
            f.frequency.value = 7000;
            const g = c.createGain();
            g.gain.value = 0.1;
            sn.connect(f);
            f.connect(g);
            g.connect(MUS_BUS);
            sn.start();
          } catch (e) {}
        }
      }, spb);
      return () => clearInterval(timer.current);
    }, [on, musicOn, track]);

    const play = useCallback(
      (name) => {
        if (!on || !sfxOn) return;
        buses();
        (SFX[name] || SFX.click)();
      },
      [on, sfxOn],
    );

    return {
      on,
      setOn,
      musicOn,
      setMusicOn,
      sfxOn,
      setSfxOn,
      track,
      setTrack,
      vol,
      setVol,
      sfxVol,
      setSfxVol,
      play,
      TRACKS,
    };
  }

  // ---------- Jukebox UI ----------
  function Jukebox({ A, open, onToggle }) {
    const t = A.TRACKS[A.track];
    return (
      <div className={"juke" + (open ? " open" : "")}>
        <button className="juke-tab" onClick={onToggle} title="sound">
          <span className="jt-ico">{A.on && A.musicOn ? "♫" : "♪"}</span>
          {A.on && A.musicOn && (
            <span className="jt-eq">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </button>
        {open && (
          <div className="juke-body">
            <div className="juke-head">
              <span
                className="fd"
                style={{
                  fontSize: 8,
                  color: "var(--frost)",
                  letterSpacing: ".12em",
                }}
              >
                ▸ JUKEBOX
              </span>
              <button className="btn sm ghost" onClick={onToggle}>
                ✕
              </button>
            </div>
            {!A.on ? (
              <button
                className="btn lg block"
                style={{ marginTop: 10 }}
                onClick={() => {
                  A.setOn(true);
                  setTimeout(() => A.play("coin"), 60);
                }}
              >
                ▸ ENABLE SOUND
              </button>
            ) : (
              <>
                <div className="juke-now">
                  <div className="jn-name">
                    {String(t.id + 1).padStart(2, "0")} · {t.name}
                  </div>
                  <div className="jn-mood">
                    {t.mood} · {t.bpm} BPM
                  </div>
                </div>
                <div className="juke-grid">
                  {A.TRACKS.map((x) => (
                    <button
                      key={x.id}
                      className="juke-cell"
                      data-on={A.track === x.id ? "1" : undefined}
                      onClick={() => {
                        A.setTrack(x.id);
                        A.play("click");
                      }}
                      title={x.mood}
                    >
                      <b>{String(x.id + 1).padStart(2, "0")}</b>
                      <span>{x.name}</span>
                    </button>
                  ))}
                </div>
                <div className="juke-row">
                  <span>MUSIC</span>
                  <button
                    className={"jbtn" + (A.musicOn ? " on" : "")}
                    onClick={() => A.setMusicOn(!A.musicOn)}
                  >
                    {A.musicOn ? "ON" : "OFF"}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.02"
                    value={A.vol}
                    onChange={(e) => A.setVol(+e.target.value)}
                  />
                </div>
                <div className="juke-row">
                  <span>SFX</span>
                  <button
                    className={"jbtn" + (A.sfxOn ? " on" : "")}
                    onClick={() => {
                      A.setSfxOn(!A.sfxOn);
                    }}
                  >
                    {A.sfxOn ? "ON" : "OFF"}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1.4"
                    step="0.05"
                    value={A.sfxVol}
                    onChange={(e) => A.setSfxVol(+e.target.value)}
                  />
                </div>
                <div className="juke-test">
                  {["win", "bust", "coin", "zap", "block", "levelup"].map(
                    (k) => (
                      <button key={k} onClick={() => A.play(k)}>
                        {k}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  Object.assign(window, {
    useAudio,
    Jukebox,
    SFX_LIST: Object.keys(SFX),
    TRACKS,
  });
})();
