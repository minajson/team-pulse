"use client";

import { motion } from "framer-motion";
import { CountUp, EASE_SOFT } from "@/lib/motion/primitives";
import type { LiveCounts } from "@/lib/types";

/**
 * What the room watches while voting is open: how many of us have answered,
 * and nothing else. One dot per person, lighting up as answers land — it
 * shows progress without leaking a single result, and it gives the last few
 * people a visible reason to hurry up.
 */
export function LiveAnswerMeter({ counts }: { counts: LiveCounts }) {
  const total = Math.max(counts.total, counts.responses);
  const dots = Math.min(total, 140);
  const filledDots = total > 0 ? Math.round((counts.responses / total) * dots) : 0;

  return (
    <div className="flex flex-col items-center gap-[2.4vh]">
      <p
        className="tnum text-[clamp(2.6rem,6vw,7rem)] leading-none font-black text-ink"
        aria-live="polite"
      >
        <CountUp value={counts.responses} />
        <span className="text-ink-4">/{total}</span>
      </p>
      <p className="stage-eyebrow text-ink-3">answered</p>

      {dots > 0 && (
        <div
          className="flex max-w-[62vw] flex-wrap justify-center gap-[0.7vw]"
          aria-hidden="true"
        >
          {Array.from({ length: dots }).map((_, i) => {
            const on = i < filledDots;
            return (
              <motion.span
                key={i}
                className="rounded-full"
                style={{
                  width: "clamp(6px, 0.85vw, 14px)",
                  height: "clamp(6px, 0.85vw, 14px)",
                  background: on ? "var(--color-cobalt)" : "rgba(12,13,18,0.12)",
                }}
                animate={on ? { scale: [0.6, 1.25, 1] } : { scale: 1 }}
                // A tween, not a spring: springs only interpolate between two
                // keyframes, and this pop needs an overshoot and a settle.
                transition={{ duration: 0.42, ease: EASE_SOFT, times: [0, 0.55, 1] }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
