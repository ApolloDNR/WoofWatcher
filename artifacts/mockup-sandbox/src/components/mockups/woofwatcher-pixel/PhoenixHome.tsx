import React from "react";
import "./pixel.css";

/* ---------- pixel-bitmap icon engine ---------- */
type Bitmap = string[];

function Px({ m, s = 3, c = "#0C2A33" }: { m: Bitmap; s?: number; c?: string }) {
  const cols = m[0].length;
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
            style={{ width: s, height: s, background: ch === "#" ? c : "transparent" }}
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
    ".#....#.",
    "##....##",
    "........",
    "..####..",
    ".######.",
    ".######.",
    ".######.",
    "..####..",
  ],
  bowl: [
    "........",
    "........",
    ".######.",
    "########",
    ".#....#.",
    ".######.",
    "..####..",
    "........",
  ],
  boot: [
    ".##.....",
    ".##.....",
    ".##.....",
    ".##.....",
    ".##.....",
    ".#####..",
    ".######.",
    ".######.",
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
  bone: [
    "##....##",
    "##....##",
    ".######.",
    "..####..",
    ".######.",
    "##....##",
    "##....##",
    "........",
  ],
  star: [
    "...#....",
    "...#....",
    ".######.",
    "..####..",
    ".#.##.#.",
    ".#....#.",
    "........",
    "........",
  ],
  note: [
    ".#####..",
    ".#...#..",
    ".#.#.#..",
    ".#...#..",
    ".#.#.#..",
    ".#...#..",
    ".#####..",
    "........",
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
  plus: [
    "........",
    "...##...",
    "...##...",
    ".######.",
    ".######.",
    "...##...",
    "...##...",
    "........",
  ],
  bell: [
    "...##...",
    "..####..",
    "..####..",
    ".######.",
    "########",
    "........",
    "...##...",
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
function Bar({ total = 10, filled, c }: { total?: number; filled: number; c: string }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 11,
            height: 14,
            boxSizing: "border-box",
            border: "2px solid #0C2A33",
            background: i < filled ? c : "var(--ww-empty)",
          }}
        />
      ))}
    </div>
  );
}

function Hearts({ filled = 4, total = 5 }: { filled?: number; total?: number }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <Px key={i} m={I.heart} s={2.5} c={i < filled ? "#CE4B2E" : "#E5D3BC"} />
      ))}
    </div>
  );
}

function StatRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span className="ww-pixel" style={{ fontSize: 8, width: 92, color: "var(--ww-ink)" }}>
        {label}
      </span>
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
        {/* scene */}
        <div className="ww-card" style={{ position: "relative", overflow: "hidden", padding: 4 }}>
          <img
            src="/__mockup/images/phoenix-home-pixel.png"
            alt="Phoenix at home"
            className="ww-art"
            style={{ display: "block", width: "100%", height: 208, objectFit: "cover" }}
          />

          {/* speech bubble */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 14,
              maxWidth: "62%",
              background: "#FFFFFF",
              border: "3px solid var(--ww-ink)",
              boxShadow: "3px 3px 0 var(--ww-ink)",
              padding: "8px 10px",
              fontFamily: "'Pixelify Sans', monospace",
              fontSize: 15,
              lineHeight: 1.15,
              color: "var(--ww-ink)",
            }}
          >
            Morning! Let&apos;s make it a great day!
            <div
              style={{
                position: "absolute",
                bottom: -10,
                left: 22,
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "10px solid var(--ww-ink)",
              }}
            />
          </div>

          {/* mood chip */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 14,
              background: "var(--ww-card)",
              border: "3px solid var(--ww-ink)",
              boxShadow: "2px 2px 0 var(--ww-ink)",
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Px m={I.heart} s={2.5} c="#CE4B2E" />
            <span className="ww-pixel" style={{ fontSize: 8 }}>
              Happy
            </span>
          </div>

          {/* level badge */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 14,
              background: "var(--ww-ink)",
              color: "var(--ww-cream)",
              border: "3px solid var(--ww-cream)",
              boxShadow: "2px 2px 0 var(--ww-ink)",
              padding: "4px 8px",
            }}
          >
            <span className="ww-pixel" style={{ fontSize: 8 }}>
              LV 12
            </span>
          </div>
        </div>

        {/* status panel */}
        <div className="ww-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="ww-section-title">Status</span>
            <span className="ww-pixel" style={{ fontSize: 8, color: "var(--ww-good)" }}>
              Good Boy!
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <StatRow label="Mood">
              <Hearts filled={4} total={5} />
            </StatRow>
            <StatRow label="Energy">
              <Bar filled={8} c="var(--ww-mint)" />
            </StatRow>
            <StatRow label="Hunger">
              <Bar filled={3} c="var(--ww-copper)" />
            </StatRow>
            <StatRow label="Alone Time">
              <Bar filled={2} c="var(--ww-sky)" />
            </StatRow>
            <div style={{ height: 2, background: "var(--ww-empty)", margin: "2px 0" }} />
            <StatRow label="EXP 92/100">
              <Bar filled={9} c="var(--ww-sage)" />
            </StatRow>
          </div>
        </div>

        {/* next up */}
        <button
          className="ww-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            textAlign: "left",
            cursor: "pointer",
            background: "var(--ww-mint-soft)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              background: "var(--ww-card)",
              border: "3px solid var(--ww-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Px m={I.boot} s={3} c="var(--ww-copper)" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="ww-pixel" style={{ fontSize: 9, marginBottom: 4 }}>
              Next Walk
            </div>
            <div style={{ fontFamily: "'Pixelify Sans', monospace", fontSize: 15, color: "var(--ww-ink-soft)" }}>
              In 1h 35m · 8:30 AM
            </div>
          </div>
          <Px m={I.chevR} s={3} />
        </button>

        {/* quick log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="ww-section-title">Quick Log</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {[
              { icon: I.bowl, label: "Meal", bg: "var(--ww-copper)", ic: "#FFFCF2" },
              { icon: I.boot, label: "Walk", bg: "var(--ww-sage)", ic: "#FFFCF2" },
              { icon: I.drop, label: "Potty", bg: "var(--ww-sky)", ic: "var(--ww-ink)" },
              { icon: I.bone, label: "Treat", bg: "var(--ww-card)", ic: "var(--ww-ink)" },
              { icon: I.star, label: "Training", bg: "var(--ww-lav)", ic: "var(--ww-ink)" },
              { icon: I.note, label: "Note", bg: "var(--ww-ink)", ic: "var(--ww-cream)" },
            ].map((t) => (
              <div key={t.label} className="ww-tile" style={{ background: t.bg }}>
                <Px m={t.icon} s={3} c={t.ic} />
                <span className="ww-pixel" style={{ fontSize: 7, color: t.ic }}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          height: 72,
          background: "var(--ww-card)",
          borderTop: "3px solid var(--ww-ink)",
          position: "relative",
        }}
      >
        {[
          { icon: I.home, label: "Home", active: true },
          { icon: I.book, label: "Log", active: false },
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
              opacity: t.active ? 1 : 0.55,
            }}
          >
            <Px m={t.icon} s={3} c={t.active ? "var(--ww-copper)" : "var(--ww-ink)"} />
            <span
              className="ww-pixel"
              style={{ fontSize: 7, color: t.active ? "var(--ww-copper)" : "var(--ww-ink)" }}
            >
              {t.label}
            </span>
          </button>
        ))}

        {/* center add */}
        <div style={{ position: "relative", top: -18 }}>
          <button
            aria-label="Add"
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "var(--ww-copper)",
              border: "4px solid var(--ww-ink)",
              boxShadow: "0 4px 0 var(--ww-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Px m={I.plus} s={4} c="#FFFCF2" />
          </button>
        </div>

        {[
          { icon: I.bell, label: "Alerts", active: false },
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
              opacity: 0.55,
            }}
          >
            <Px m={t.icon} s={3} c="var(--ww-ink)" />
            <span className="ww-pixel" style={{ fontSize: 7, color: "var(--ww-ink)" }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
