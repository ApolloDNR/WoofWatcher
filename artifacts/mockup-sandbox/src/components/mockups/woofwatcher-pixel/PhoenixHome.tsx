import React from "react";
import "./pixel.css";

/* ---------- pixel-bitmap icon engine ---------- */
type Bitmap = string[];

function Px({
  m,
  s = 3,
  c = "#0B1424",
  colors,
}: {
  m: Bitmap;
  s?: number;
  c?: string;
  colors?: Record<string, string>;
}) {
  const cols = m[0].length;
  const map: Record<string, string> = { "#": c, ...(colors || {}) };
  return (
    <div
      className="ww-art"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${s}px)`,
        lineHeight: 0,
      }}
    >
      {m.flatMap((row, y) =>
        row.split("").map((ch, x) => (
          <div
            key={`${x}-${y}`}
            style={{ width: s, height: s, background: map[ch] ?? "transparent" }}
          />
        )),
      )}
    </div>
  );
}

const I = {
  chevL: [
    "....#...",
    "...##...",
    "..##....",
    ".##.....",
    "..##....",
    "...##...",
    "....#...",
    "........",
  ],
  chevR: [
    "...#....",
    "...##...",
    "....##..",
    ".....##.",
    "....##..",
    "...##...",
    "...#....",
    "........",
  ],
  expand: [
    "###..###",
    "#......#",
    "#......#",
    "........",
    "........",
    "#......#",
    "#......#",
    "###..###",
  ],
  smiley: [
    ".YYYYYY.",
    "YYYYYYYY",
    "YYnYYnYY",
    "YYYYYYYY",
    "YYYYYYYY",
    "YnYYYYnY",
    "YYnnnnYY",
    ".YYYYYY.",
  ],
  bolt: [
    "...##...",
    "..##....",
    ".###....",
    ".#####..",
    "...##...",
    "..##....",
    ".##.....",
    "........",
  ],
  bowl: [
    "........",
    "..#..#..",
    ".######.",
    "########",
    "########",
    ".#....#.",
    "..####..",
    "........",
  ],
  drop: [
    "...#....",
    "...#....",
    "..###...",
    "..###...",
    ".#####..",
    ".#####..",
    ".#####..",
    "..###...",
  ],
  heart: [
    ".##..##.",
    "########",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
    "........",
  ],
  paw: [
    "#.#..#.#",
    "#.#..#.#",
    "........",
    "..####..",
    ".######.",
    ".######.",
    ".######.",
    "..####..",
  ],
  home: [
    "...##...",
    "..####..",
    ".######.",
    "########",
    ".#....#.",
    ".#.##.#.",
    ".#.##.#.",
    "........",
  ],
  list: [
    "........",
    "##.####.",
    "........",
    "##.####.",
    "........",
    "##.####.",
    "........",
    "........",
  ],
  book: [
    ".######.",
    ".#..#.#.",
    ".#..#.#.",
    ".#..#.#.",
    ".#..#.#.",
    ".#..#.#.",
    ".######.",
    "........",
  ],
  menu: [
    "........",
    "########",
    "........",
    "########",
    "........",
    "########",
    "........",
    "........",
  ],
};

/* ---------- composite primitives ---------- */
function Bar({ total = 5, filled, c }: { total?: number; filled: number; c: string }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 15,
            height: 13,
            boxSizing: "border-box",
            border: "2px solid var(--ww-ink)",
            background: i < filled ? c : "var(--ww-empty)",
          }}
        />
      ))}
    </div>
  );
}

function StatRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span className="ww-pixel" style={{ fontSize: 8, color: "var(--ww-ink)" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
    </div>
  );
}

/* ---------- screen ---------- */
export default function PhoenixHome() {
  return (
    <div className="ww-root">
      {/* status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px 4px",
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
          color: "var(--ww-ink)",
        }}
      >
        <span>9:41</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
            {[5, 8, 11, 14].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: "var(--ww-ink)" }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div
              style={{
                width: 22,
                height: 11,
                border: "2px solid var(--ww-ink)",
                padding: 1,
                display: "flex",
              }}
            >
              <div style={{ flex: 1, background: "var(--ww-ink)" }} />
            </div>
            <div style={{ width: 2, height: 5, background: "var(--ww-ink)" }} />
          </div>
        </div>
      </div>

      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px 12px",
          borderBottom: "3px solid var(--ww-ink)",
          background: "var(--ww-cream)",
        }}
      >
        <button
          aria-label="Back"
          style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
        >
          <Px m={I.chevL} s={3} />
        </button>
        <span className="ww-pixel" style={{ fontSize: 11 }}>
          Phoenix Home
        </span>
        <button
          aria-label="Expand"
          style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
        >
          <Px m={I.expand} s={3} />
        </button>
      </div>

      <div className="ww-scroll">
        {/* scene — board art with baked-in speech bubble */}
        <div className="ww-card" style={{ position: "relative", overflow: "hidden", padding: 4 }}>
          <img
            src="/__mockup/images/phoenix-garden.png"
            alt="Phoenix in the garden"
            className="ww-art"
            style={{ display: "block", width: "100%", height: "auto" }}
          />

          {/* mood chip */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "var(--ww-card)",
              border: "3px solid var(--ww-ink)",
              boxShadow: "2px 2px 0 var(--ww-ink)",
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Px m={I.smiley} s={2.5} colors={{ Y: "var(--ww-yellow)", n: "var(--ww-ink)" }} />
            <span className="ww-pixel" style={{ fontSize: 8 }}>
              Happy
            </span>
          </div>
        </div>

        {/* status panel */}
        <div className="ww-card" style={{ padding: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <span className="ww-section-title">Status</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <StatRow
              icon={<Px m={I.smiley} s={2.5} colors={{ Y: "var(--ww-yellow)", n: "var(--ww-ink)" }} />}
              label="Mood"
            >
              <span className="ww-pixel" style={{ fontSize: 9 }}>
                Happy
              </span>
            </StatRow>
            <StatRow icon={<Px m={I.bolt} s={2.5} c="var(--ww-sage)" />} label="Energy">
              <Bar filled={4} c="var(--ww-sage)" />
            </StatRow>
            <StatRow icon={<Px m={I.bowl} s={2.5} c="var(--ww-copper)" />} label="Hunger">
              <Bar filled={3} c="var(--ww-copper)" />
            </StatRow>
            <StatRow icon={<Px m={I.drop} s={2.5} c="var(--ww-bile)" />} label="Bile Risk">
              <span className="ww-pixel" style={{ fontSize: 9, color: "var(--ww-bile)" }}>
                Low
              </span>
            </StatRow>
            <StatRow icon={<Px m={I.heart} s={2.5} c="var(--ww-copper)" />} label="Bond">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bar filled={5} c="var(--ww-sage)" />
                <span className="ww-pixel" style={{ fontSize: 9 }}>
                  92%
                </span>
              </div>
            </StatRow>
          </div>
        </div>

        {/* next up */}
        <div
          className="ww-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              background: "var(--ww-mint)",
              border: "3px solid var(--ww-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Px m={I.paw} s={3} c="var(--ww-ink)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ww-pixel" style={{ fontSize: 8, marginBottom: 5, opacity: 0.85 }}>
              Next Up
            </div>
            <div style={{ fontFamily: "'Pixelify Sans', monospace", fontSize: 15, color: "var(--ww-ink)" }}>
              Walk with Emma
            </div>
          </div>
          <button
            style={{
              flexShrink: 0,
              background: "var(--ww-sage)",
              border: "3px solid var(--ww-ink)",
              boxShadow: "3px 3px 0 var(--ww-ink)",
              padding: "9px 10px",
              cursor: "pointer",
            }}
          >
            <span className="ww-pixel" style={{ fontSize: 8, color: "#FFFDF6" }}>
              Start Walk
            </span>
          </button>
        </div>
      </div>

      {/* bottom tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          height: 72,
          background: "var(--ww-ink)",
          borderTop: "3px solid var(--ww-ink)",
          position: "relative",
        }}
      >
        {[
          { icon: I.home, label: "Home", active: true },
          { icon: I.list, label: "Log", active: false },
        ].map((t) => (
          <button
            key={t.label}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <Px m={t.icon} s={3} c={t.active ? "var(--ww-copper)" : "var(--ww-mint)"} />
            <span
              className="ww-pixel"
              style={{ fontSize: 7, color: t.active ? "var(--ww-copper)" : "var(--ww-mint)" }}
            >
              {t.label}
            </span>
          </button>
        ))}

        {/* center paw */}
        <div style={{ position: "relative", top: -16 }}>
          <button
            aria-label="Quick log"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--ww-cream)",
              border: "3px solid var(--ww-ink)",
              boxShadow: "0 4px 0 var(--ww-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Px m={I.paw} s={4} c="var(--ww-ink)" />
          </button>
        </div>

        {[
          { icon: I.book, label: "Guide", active: false },
          { icon: I.menu, label: "More", active: false },
        ].map((t) => (
          <button
            key={t.label}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <Px m={t.icon} s={3} c="var(--ww-mint)" />
            <span className="ww-pixel" style={{ fontSize: 7, color: "var(--ww-mint)" }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
