"use client";

import { forwardRef } from "react";
import { TEAM_VALUES } from "@/lib/content/session-plan";
import type { SessionSummary } from "@/lib/types";
import { anchorFor, petalPath, RING_STEPS } from "@/lib/viz/radial";

export const CARD_W = 1600;
export const CARD_H = 900;

/**
 * Static, print-quality versions of the two visuals worth keeping: the Team
 * DNA and the response wall.
 *
 * Rendered off-screen at a fixed 1600×900 rather than screenshotting the
 * projector, so the exported PNG does not depend on the presenter's window
 * size, scroll position, or which frame of an animation was on screen.
 */

const shell: React.CSSProperties = {
  width: CARD_W,
  height: CARD_H,
  background: "#fbfaf7",
  color: "#0c0d12",
  fontFamily: "var(--font-display), Helvetica, Arial, sans-serif",
  position: "relative",
  overflow: "hidden",
  padding: 72,
  boxSizing: "border-box",
};

export const DnaCard = forwardRef<HTMLDivElement, { summary: SessionSummary }>(
  function DnaCard({ summary }, ref) {
    const lines = summary.values.dna;
    const byLabel = new Map(lines.map((l) => [l.label, l.pct]));
    const values = TEAM_VALUES.map((v) => ({ ...v, pct: byLabel.get(v.label) ?? 0 }));
    const maxShare = Math.max(1, ...values.map((v) => v.pct));

    // Wider than tall so the outer labels have room — same reason as the
    // projector's radial.
    const vbW = 880;
    const vbH = 620;
    const cx = vbW / 2;
    const cy = vbH / 2;
    const inner = 54;
    const outer = 186;
    const labelRadius = outer + 38;
    const slice = (Math.PI * 2) / values.length;

    return (
      <div ref={ref} style={shell}>
        <p style={{ fontSize: 18, letterSpacing: "0.24em", fontWeight: 800, color: "#9f6200" }}>
          TEAM PULSE · SESSION {summary.code}
        </p>
        <p style={{ fontSize: 76, fontWeight: 900, letterSpacing: "-0.035em", margin: "16px 0 0" }}>
          Our Team DNA
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 64, marginTop: 12 }}>
          <svg width={vbW} height={vbH} viewBox={`0 0 ${vbW} ${vbH}`}>
            {RING_STEPS.map((step) => (
              <circle
                key={step}
                cx={cx}
                cy={cy}
                r={inner + (outer - inner) * step}
                fill="none"
                stroke="rgba(12,13,18,0.09)"
                strokeWidth={1.5}
              />
            ))}
            {values.map((value, i) => {
              const reach = inner + (outer - inner) * Math.min(1, value.pct / maxShare);
              const angle = i * slice - Math.PI / 2;
              const lx = cx + Math.cos(angle) * labelRadius;
              const ly = cy + Math.sin(angle) * labelRadius;
              return (
                <g key={value.id}>
                  <path
                    d={petalPath(cx, cy, angle, slice, inner, reach)}
                    fill={`hsl(${value.hue} 68% 52%)`}
                    fillOpacity={0.85}
                    stroke={`hsl(${value.hue} 72% 38%)`}
                    strokeWidth={2}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={anchorFor(Math.cos(angle))}
                    dominantBaseline="middle"
                    fill="#0c0d12"
                    fontSize={19}
                    fontWeight={800}
                  >
                    {value.label}
                  </text>
                  <text
                    x={lx}
                    y={ly + 22}
                    textAnchor={anchorFor(Math.cos(angle))}
                    dominantBaseline="middle"
                    fill={`hsl(${value.hue} 74% 34%)`}
                    fontSize={22}
                    fontWeight={900}
                  >
                    {Math.round(value.pct)}%
                  </text>
                </g>
              );
            })}
            <circle
              cx={cx}
              cy={cy}
              r={inner * 0.72}
              fill="#ffffff"
              stroke="rgba(12,13,18,0.14)"
              strokeWidth={2}
            />
          </svg>

          <ol style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
            {[...values]
              .sort((a, b) => b.pct - a.pct)
              .map((value, rank) => (
                <li
                  key={value.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 16,
                    padding: "11px 0",
                    borderBottom: "1px solid rgba(12,13,18,0.10)",
                  }}
                >
                  <span style={{ fontSize: 17, fontWeight: 900, color: "#6e727a", width: 26 }}>
                    {rank + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 25, fontWeight: 700 }}>{value.label}</span>
                  <span
                    style={{
                      fontSize: 29,
                      fontWeight: 900,
                      color: `hsl(${value.hue} 74% 34%)`,
                    }}
                  >
                    {Math.round(value.pct)}%
                  </span>
                </li>
              ))}
          </ol>
        </div>

        <p style={{ position: "absolute", bottom: 40, left: 72, fontSize: 16, color: "#6e727a" }}>
          {summary.participants.total} participants · {summary.participants.room} in the room ·{" "}
          {summary.participants.online} online
        </p>
      </div>
    );
  },
);

export const WallCard = forwardRef<HTMLDivElement, { summary: SessionSummary }>(
  function WallCard({ summary }, ref) {
    const statements = summary.voice.topStatements;

    return (
      <div ref={ref} style={shell}>
        <p style={{ fontSize: 18, letterSpacing: "0.24em", fontWeight: 800, color: "#9f6200" }}>
          TEAM PULSE · SESSION {summary.code}
        </p>
        <p
          style={{
            fontSize: 62,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            margin: "18px 0 40px",
            maxWidth: 1200,
          }}
        >
          Our team would be stronger if we…
        </p>

        {statements.length === 0 ? (
          <p style={{ fontSize: 32, color: "#6e727a" }}>No statements were submitted.</p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {statements.map((statement, i) => (
              <li
                key={`${statement.text}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 26,
                  padding: "18px 0",
                  borderBottom: "1px solid rgba(12,13,18,0.10)",
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 900, color: "#6e727a", width: 44 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {statement.text}
                </span>
                {statement.hearts > 0 && (
                  <span style={{ fontSize: 27, fontWeight: 900, color: "#9f6200" }}>
                    ♥ {statement.hearts}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        <p style={{ position: "absolute", bottom: 40, left: 72, fontSize: 16, color: "#6e727a" }}>
          Anonymous — no participant is identified.
        </p>
      </div>
    );
  },
);
