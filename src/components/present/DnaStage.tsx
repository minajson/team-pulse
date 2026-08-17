"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Question } from "@/lib/content/session-plan";
import { CountUp, EASE_SOFT, KineticPhrase } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { LiveCounts, Phase, QuestionResults } from "@/lib/types";
import { anchorFor, petalPath, RING_STEPS } from "@/lib/viz/radial";

/**
 * Round 5 — Our Team DNA.
 *
 * Eight weighted petals growing from a common centre. Chosen over a pie chart
 * for a reason that matters here: a pie says "these are slices of one fixed
 * thing", while this says "these are eight things the team is choosing to grow".
 * Each petal's reach is its share, so the shape of the whole is readable from
 * the back of the room before a single number appears.
 */

export function DnaStage({
  question,
  results,
  phase,
  counts,
}: {
  question: Question;
  results: QuestionResults | null;
  phase: Phase;
  counts: LiveCounts;
}) {
  const revealed = phase === "revealed" || phase === "discuss";
  const values = question.values ?? [];
  const reduce = useReducedMotion();
  const { play } = useSound();

  const wasRevealed = useRef(false);
  useEffect(() => {
    if (revealed && !wasRevealed.current) {
      wasRevealed.current = true;
      play("dnaComplete");
    }
    if (!revealed) wasRevealed.current = false;
  }, [revealed, play]);

  // Normalised so the largest petal always reaches the outer ring; without
  // this an even 12.5%-each split would render as a small, timid flower.
  const shares = values.map(
    (v) => results?.points.find((p) => p.valueId === v.id)?.pct ?? 0,
  );
  const maxShare = Math.max(1, ...shares);

  /*
   * The canvas is wider than it is tall on purpose: the labels sit outside the
   * outer ring, and the left/right ones are the widest text on screen. A square
   * viewBox clips them.
   */
  const vbW = 1500;
  const vbH = 1080;
  const cx = vbW / 2;
  const cy = vbH / 2;
  const inner = 104;
  const outer = 338;
  const labelRadius = outer + 62;
  const slice = (Math.PI * 2) / Math.max(1, values.length);

  return (
    <div className="flex h-full flex-col justify-center gap-[1.6vh]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <h1 className="display-tight text-[clamp(1.8rem,4.6vw,5.5rem)] text-ink">
          Our Team DNA
        </h1>
        <p className="tnum text-[clamp(0.85rem,1.35vw,1.5rem)] font-semibold text-ink-3">
          <CountUp value={counts.responses} /> of {counts.total} have built theirs
        </p>
      </div>

      <div className="grid min-h-0 flex-1 items-center gap-[2vw] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.85fr)]">
        <div className="relative flex h-full min-h-0 items-center justify-center">
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className="mx-auto max-h-[72vh] w-full"
            role="img"
            aria-label={`Team DNA: ${values
              .map((v, i) => `${v.label} ${Math.round(shares[i])} percent`)
              .join(", ")}`}
          >
            {/* Reference rings — give the petals a scale to be read against. */}
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
              const share = shares[i];
              const reach = inner + (outer - inner) * Math.min(1, share / maxShare);
              const angle = i * slice - Math.PI / 2;
              const hue = value.hue;

              const petal = petalPath(cx, cy, angle, slice, inner, reach);
              const lx = cx + Math.cos(angle) * labelRadius;
              const ly = cy + Math.sin(angle) * labelRadius;

              return (
                <g key={value.id}>
                  <motion.path
                    d={petal}
                    fill={`hsl(${hue} 68% 52%)`}
                    fillOpacity={0.82}
                    stroke={`hsl(${hue} 72% 38%)`}
                    strokeWidth={2}
                    initial={reduce ? false : { opacity: 0, scale: 0.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                    transition={{ duration: 0.9, ease: EASE_SOFT, delay: i * 0.05 }}
                  />

                  <text
                    x={lx}
                    y={ly}
                    textAnchor={anchorFor(Math.cos(angle))}
                    dominantBaseline="middle"
                    fill="var(--color-ink)"
                    fontSize={40}
                    fontWeight={800}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {value.label}
                  </text>

                  <AnimatePresence>
                    {revealed && (
                      <motion.text
                        x={lx}
                        y={ly + 48}
                        textAnchor={anchorFor(Math.cos(angle))}
                        dominantBaseline="middle"
                        fill={`hsl(${hue} 74% 34%)`}
                        fontSize={46}
                        fontWeight={900}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.45 + i * 0.06, duration: 0.5 }}
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {Math.round(share)}%
                      </motion.text>
                    )}
                  </AnimatePresence>
                </g>
              );
            })}

            {/* Core */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={inner * 0.72}
              fill="var(--color-surface)"
              stroke="rgba(12,13,18,0.14)"
              strokeWidth={2}
              animate={reduce ? {} : { scale: [1, 1.05, 1] }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>

        <AnimatePresence>
          {revealed && (
            <motion.ol
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.6, duration: 0.6, ease: EASE_SOFT }}
              className="hidden flex-col gap-[0.9vh] lg:flex"
            >
              {values
                .map((v, i) => ({ value: v, share: shares[i] }))
                .sort((a, b) => b.share - a.share)
                .map(({ value, share }, rank) => (
                  <li key={value.id} className="flex items-baseline gap-[0.8vw]">
                    <span className="tnum text-[clamp(0.75rem,1.05vw,1.2rem)] font-black text-ink-3">
                      {rank + 1}
                    </span>
                    <span className="flex-1 text-[clamp(0.95rem,1.4vw,1.7rem)] font-bold text-ink">
                      {value.label}
                    </span>
                    <span
                      className="tnum text-[clamp(1.05rem,1.6vw,1.95rem)] font-black"
                      style={{ color: `hsl(${value.hue} 74% 34%)` }}
                    >
                      {Math.round(share)}%
                    </span>
                  </li>
                ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-[6vh]">
        <AnimatePresence>
          {revealed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.3 }}
              className="display-loose text-[clamp(1.4rem,3vw,3.4rem)] text-balance text-amber-deep"
            >
              <KineticPhrase
                text={question.discussPrompt ?? "Is this who we are today — or who we want to become?"}
                delay={1.4}
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
