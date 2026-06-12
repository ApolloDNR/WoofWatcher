import React from "react";
import "./pixel.css";

/* ---------- pixel-art content icons (cropped straight from the board) ---------- */
function PxIcon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <img
      src={`/__mockup/images/icons/${name}.png`}
      alt=""
      className="ww-img"
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}

/* ---------- clean line icons for chrome (NOT pixelated) ---------- */
const sv = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ChevronLeft = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <path d="M15 5 L8 12 L15 19" />
  </svg>
);
const Expand = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
  </svg>
);
const NavHome = ({ s = 23 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <path d="M4 11 L12 4 L20 11" />
    <path d="M6 10 V19 H18 V10" />
    <path d="M10 19 v-4.5 h4 v4.5" />
  </svg>
);
const NavLog = ({ s = 23 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <circle cx="6" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="17" r="1.1" fill="currentColor" stroke="none" />
    <path d="M10 7 h9 M10 12 h9 M10 17 h7" />
  </svg>
);
const NavGuide = ({ s = 23 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <path d="M12 6.5 C10 5 6.2 5 4.3 5.8 V18.4 C6.2 17.6 10 17.6 12 19 C14 17.6 17.8 17.6 19.7 18.4 V5.8 C17.8 5 14 5 12 6.5 Z" />
    <path d="M12 6.5 V19" />
  </svg>
);
const NavMore = ({ s = 23 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...sv}>
    <path d="M4 7 h16 M4 12 h16 M4 17 h16" />
  </svg>
);
const PawSolid = ({ s = 26 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <ellipse cx="6.5" cy="10" rx="2" ry="2.6" />
    <ellipse cx="11" cy="7.4" rx="2.1" ry="2.8" />
    <ellipse cx="15.7" cy="8.6" rx="2" ry="2.6" />
    <ellipse cx="19" cy="12.4" rx="1.7" ry="2.2" />
    <path d="M11 12.2 c-3.2 0-5.6 2.4-5.6 5 0 1.9 1.7 2.9 4 2.6 1.1-.15 2.1-.15 3.2 0 2.3.3 4-.7 4-2.6 0-2.6-2.4-5-5.6-5Z" />
  </svg>
);

/* status-bar glyphs */
const Signal = () => (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
    <rect x="0" y="8" width="3" height="4" rx="1" />
    <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
    <rect x="9" y="3" width="3" height="9" rx="1" />
    <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" />
  </svg>
);
const Wifi = () => (
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2 4.2 C5.5 1.4 10.5 1.4 14 4.2" />
    <path d="M4.2 6.8 C6.6 4.9 9.4 4.9 11.8 6.8" />
    <path d="M6.6 9.3 C7.5 8.6 8.5 8.6 9.4 9.3" />
  </svg>
);
const Battery = () => (
  <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
    <rect x="0.6" y="0.6" width="22" height="11.8" rx="3" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <rect x="2.2" y="2.2" width="16.5" height="8.6" rx="1.6" fill="currentColor" />
    <rect x="24" y="4" width="2" height="5" rx="1" fill="currentColor" opacity="0.5" />
  </svg>
);

/* ---------- segmented meter (clean rounded cells) ---------- */
function Bar({
  total,
  filled,
  color,
  w = 11,
  h = 13,
}: {
  total: number;
  filled: number;
  color: string;
  w?: number;
  h?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: w,
            height: h,
            borderRadius: 3,
            background: i < filled ? color : "var(--ww-track)",
          }}
        />
      ))}
    </div>
  );
}

const Divider = () => (
  <div style={{ height: 1, background: "var(--ww-border-soft)", margin: "11px 0" }} />
);

const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: "1px" };
const valStyle: React.CSSProperties = {
  fontFamily: "var(--ww-font-body)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ww-ink)",
};
const mutedStyle: React.CSSProperties = {
  fontFamily: "var(--ww-font-body)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ww-ink-soft)",
};

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
          padding: "10px 20px 2px",
          color: "var(--ww-ink)",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.3px" }}>9:41</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Signal />
          <Wifi />
          <Battery />
        </div>
      </div>

      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px 12px",
          borderBottom: "1px solid var(--ww-border)",
        }}
      >
        <button
          aria-label="Back"
          className="ww-press"
          style={{ background: "none", border: "none", padding: 4, color: "var(--ww-ink)" }}
        >
          <ChevronLeft />
        </button>
        <span className="ww-label" style={{ fontSize: 13, letterSpacing: "2px" }}>
          Phoenix Home
        </span>
        <button
          aria-label="Expand"
          className="ww-press"
          style={{ background: "none", border: "none", padding: 4, color: "var(--ww-ink)" }}
        >
          <Expand />
        </button>
      </div>

      <div className="ww-scroll">
        {/* hero scene — board pixel art, baked-in "I'm ready!" bubble */}
        <div className="ww-card" style={{ overflow: "hidden", padding: 0 }}>
          <img
            src="/__mockup/images/phoenix-indoor.png"
            alt="Phoenix at home"
            className="ww-img"
            style={{ width: "100%", height: "auto" }}
          />
        </div>

        {/* status panel */}
        <div className="ww-card" style={{ padding: "16px 18px" }}>
          {/* MOOD */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <span className="ww-label" style={labelStyle}>
                Mood
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <PxIcon name="smiley" size={24} />
                <Bar total={5} filled={4} color="var(--ww-sage)" w={9} h={11} />
              </div>
            </div>
            <span style={mutedStyle}>Happy</span>
          </div>

          <Divider />

          {/* ENERGY */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="ww-label" style={labelStyle}>
              Energy
            </span>
            <Bar total={8} filled={6} color="var(--ww-sage)" />
          </div>

          <Divider />

          {/* HUNGER */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="ww-label" style={labelStyle}>
              Hunger
            </span>
            <Bar total={8} filled={5} color="var(--ww-copper)" />
          </div>

          <Divider />

          {/* BILE RISK */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="ww-label" style={labelStyle}>
              Bile Risk
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PxIcon name="drop" size={20} />
              <span style={mutedStyle}>Low</span>
            </div>
          </div>

          <Divider />

          {/* BOND */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="ww-label" style={labelStyle}>
              Bond
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Bar total={5} filled={5} color="var(--ww-sage)" w={9} h={11} />
              <PxIcon name="heart" size={20} />
              <span style={valStyle}>92%</span>
            </div>
          </div>
        </div>

        {/* next up */}
        <div className="ww-card" style={{ display: "flex", alignItems: "center", gap: 13, padding: 13 }}>
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              background: "var(--ww-mint)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PxIcon name="paw" size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ww-label" style={{ fontSize: 9, letterSpacing: "1px", marginBottom: 5, color: "var(--ww-ink-soft)" }}>
              Next Up
            </div>
            <div style={{ ...valStyle, lineHeight: 1.1 }}>Walk with Emma</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ww-ink-soft)", marginTop: 1 }}>
              In 1h 35m · 8:30 AM
            </div>
          </div>
          <button
            className="ww-press"
            style={{
              flexShrink: 0,
              background: "var(--ww-copper)",
              border: "none",
              borderRadius: 13,
              padding: "11px 13px",
              boxShadow: "0 4px 12px rgba(197, 90, 42, 0.30)",
            }}
          >
            <span className="ww-label" style={{ fontSize: 8, letterSpacing: "1px", color: "#FFF7EC" }}>
              Start Walk
            </span>
          </button>
        </div>
      </div>

      {/* bottom nav — clean navy bar, line icons, raised paw */}
      <Nav />
    </div>
  );
}

function Nav() {
  const items = [
    { key: "home", label: "Home", icon: <NavHome />, active: true },
    { key: "log", label: "Log", icon: <NavLog />, active: false },
    { key: "center" },
    { key: "guide", label: "Guide", icon: <NavGuide />, active: false },
    { key: "more", label: "More", icon: <NavMore />, active: false },
  ];
  const active = "#F6EEDD";
  const idle = "rgba(246, 238, 221, 0.52)";

  return (
    <div
      style={{
        background: "var(--ww-nav)",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        padding: "12px 14px 16px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        boxShadow: "0 -6px 20px rgba(21, 35, 60, 0.16)",
      }}
    >
      {items.map((t) =>
        t.key === "center" ? (
          <div key="center" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <button
              aria-label="Quick log"
              className="ww-press"
              style={{
                width: 58,
                height: 58,
                marginTop: -34,
                borderRadius: "50%",
                background: "var(--ww-card)",
                border: "4px solid var(--ww-nav)",
                color: "var(--ww-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 14px rgba(21,35,60,0.30)",
              }}
            >
              <PawSolid s={28} />
            </button>
          </div>
        ) : (
          <button
            key={t.key}
            className="ww-press"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              color: t.active ? active : idle,
            }}
          >
            {t.icon}
            <span style={{ fontFamily: "var(--ww-font-body)", fontSize: 11, fontWeight: 600 }}>
              {t.label}
            </span>
          </button>
        ),
      )}
    </div>
  );
}
