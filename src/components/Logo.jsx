// NAVARA Nursing Home brand mark.
//
// LogoImg  = the real logo image if the facility dropped one at
//            public/logo.png (or .jpg); otherwise the SVG fallback below.
// TreeMark = SVG tree (compact use: header, bed card).
// LogoFull = SVG full vertical lockup matching the printed logo.

import { useState } from "react";

// Shows /logo.png → /logo.jpg → svg fallback. The facility just drops their
// exported logo file into public/logo.png; no code change needed.
export function LogoImg({ height = 130, fallback = null, style }) {
  const [stage, setStage] = useState(0); // 0=png, 1=jpg, 2=fallback
  const base = import.meta.env.BASE_URL || "/";
  if (stage >= 2) return fallback;
  return (
    <img
      src={base + (stage === 0 ? "logo.png" : "logo.jpg")}
      alt="NAVARA Nursing Home"
      onError={() => setStage((s) => s + 1)}
      style={{ height, width: "auto", maxWidth: "100%", display: "block", margin: "0 auto", ...style }}
    />
  );
}

const GOLDEN = 137.50776; // degrees
const SERIF = "Georgia, 'Times New Roman', serif";

// Round leafy canopy: phyllotaxis-placed leaf ovals.
function Canopy({ cx, cy, spread, count, leaf, color }) {
  const leaves = [];
  for (let i = 3; i < count; i++) {
    const t = (i + 0.5) / count;
    const r = Math.sqrt(t) * spread;
    const a = (i * GOLDEN * Math.PI) / 180;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.94;
    if (y > cy + spread * 0.62) continue; // sit above the trunk
    const deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    const s = leaf * (0.82 + ((i * 7) % 5) * 0.08);
    leaves.push(
      <ellipse key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} rx={s.toFixed(2)} ry={(s * 0.4).toFixed(2)} transform={`rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`} fill={color} />
    );
  }
  return <>{leaves}</>;
}

// tapered horizontal rule (lens shape, pointed ends) like the printed logo
function Rule({ x1, x2, y, h = 1.3, color }) {
  const mid = (x1 + x2) / 2;
  return <path d={`M${x1} ${y} Q ${mid} ${y - h} ${x2} ${y} Q ${mid} ${y + h} ${x1} ${y} Z`} fill={color} />;
}

export function TreeMark({ size = 40, color = "var(--color-brand)" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <Canopy cx={32} cy={24} spread={20} count={90} leaf={1.75} color={color} />
      <g stroke={color} fill="none" strokeLinecap="round">
        <path d="M29 52 C29 44 30 39 32 35 M35 52 C35 44 34 39 32 35" strokeWidth="2" />
        {/* wide roots */}
        <path d="M32 52 C25 52 20 53 14 53 M32 52 C39 52 44 53 50 53" strokeWidth="1.7" />
        {/* branches into the canopy */}
        <path d="M32 36 C25 30 21 26 17 20 M32 37 C29 29 27 24 26 17 M32 35 C32 27 32 21 32 14 M32 37 C35 29 37 24 38 17 M32 36 C39 30 43 26 47 20" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

// Full stacked logo (used on the login screen) — closest match to the print logo.
export function LogoFull({ width = 260, color = "var(--color-brand)" }) {
  return (
    <svg viewBox="0 0 240 214" width={width} height={(width * 214) / 240} role="img" aria-label="NAVARA Nursing Home" style={{ display: "block" }}>
      <Canopy cx={120} cy={58} spread={50} count={150} leaf={3.1} color={color} />
      <g stroke={color} fill="none" strokeLinecap="round">
        {/* trunk */}
        <path d="M113 116 C113 106 115 98 120 93 M127 116 C127 106 125 98 120 93" strokeWidth="2.6" />
        <path d="M118 114 L118.5 96 M122 114 L121.5 96" strokeWidth="0.9" opacity="0.55" />
        {/* wide-spreading roots toward MEDIC / HEAL */}
        <path d="M120 116 C104 117 92 118 76 119 M120 116 C136 117 148 118 164 119" strokeWidth="2.2" />
        <path d="M120 116 C110 117 102 119 94 121 M120 116 C130 117 138 119 146 121" strokeWidth="1.4" />
        {/* branches */}
        <path d="M120 95 C107 86 99 79 91 68 M120 97 C114 85 110 75 108 60 M120 93 C120 80 120 70 120 52 M120 97 C126 85 130 75 132 60 M120 95 C133 86 141 79 149 68" strokeWidth="1.9" />
        <path d="M108 76 C102 74 97 74 92 76 M132 76 C138 74 143 74 148 76" strokeWidth="1.3" />
      </g>

      {/* MEDIC · HEAL flanking the base */}
      <text x="76" y="120" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" letterSpacing="2.5" fontFamily={SERIF}>MEDIC</text>
      <text x="164" y="120" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" letterSpacing="2.5" fontFamily={SERIF}>HEAL</text>

      {/* rules + serif wordmark */}
      <Rule x1={46} x2={194} y={127} h={1.4} color={color} />
      <text x="120" y="164" textAnchor="middle" fill={color} fontSize="37" fontWeight="700" letterSpacing="4" fontFamily={SERIF}>NAVARA</text>
      <text x="120" y="185" textAnchor="middle" fill={color} fontSize="12" fontWeight="500" letterSpacing="7" fontFamily={SERIF}>NURSING HOME</text>
      <Rule x1={64} x2={176} y={197} h={1.1} color={color} />
    </svg>
  );
}

// Horizontal lockup: mark + NAVARA / NURSING HOME wordmark.
export default function Logo({ size = 44, showWordmark = true }) {
  return (
    <div className="logo-lockup">
      <TreeMark size={size} />
      {showWordmark && (
        <div className="logo-words">
          <div className="logo-name">NAVARA</div>
          <div className="logo-sub">NURSING HOME</div>
        </div>
      )}
    </div>
  );
}
