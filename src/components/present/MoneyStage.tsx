"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import type { Question } from "@/lib/content/session-plan";
import { CountUp, EASE_SOFT, KineticPhrase, springDrop } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { LiveCounts, Phase, QuestionResults } from "@/lib/types";

const POT = 10_000;
/** Two notes per row keeps each one wide enough to still read as a banknote. */
const PER_ROW = 2;

/**
 * Round 4 — the $10,000 decision.
 *
 * Every vote is one banknote, dropped into the category it was spent on. The
 * height of each stack *is* the data, so the animation never has to be paid for
 * later with a separate chart: when the facilitator reveals, the numbers simply
 * appear under stacks the room has already watched grow.
 *
 * Everything financial here is green. The brand amber is used all over the rest
 * of the app for emphasis, so money gets its own colour — otherwise "$10,000"
 * reads as just another highlight instead of as cash.
 */
export function MoneyStage({
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
  const options = useMemo(() => question.options ?? [], [question.options]);
  const reduce = useReducedMotion();
  const { play } = useSound();

  const countFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const option of options) {
      map.set(option.id, results?.options.find((o) => o.optionId === option.id)?.count ?? 0);
    }
    return map;
  }, [options, results]);

  // Notes are keyed by index so React keeps existing ones in place while new
  // ones drop — re-keying on every frame would re-animate the whole stack.
  const previous = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let added = 0;
    for (const option of options) {
      const now = countFor.get(option.id) ?? 0;
      const before = previous.current.get(option.id) ?? 0;
      if (now > before) added += now - before;
      previous.current.set(option.id, now);
    }
    if (added > 0) {
      play("moneyFlick", 140);
      window.setTimeout(() => play("moneyDrop", 200), 260);
    }
  }, [countFor, options, play]);

  useEffect(() => {
    if (revealed) play("reveal");
  }, [revealed, play]);

  const totalSelections = options.reduce((sum, o) => sum + (countFor.get(o.id) ?? 0), 0);
  const maxCount = Math.max(1, ...options.map((o) => countFor.get(o.id) ?? 0));

  /*
   * Vertical pitch shrinks as the tallest stack grows, so a busy room still
   * fits inside the well — notes overlap like a real pile rather than
   * overflowing the card. The height cap keeps each note in banknote
   * proportions (roughly 2.4:1) instead of letting it square off into a block.
   */
  const rowsNeeded = Math.ceil(maxCount / PER_ROW);
  const pitch = 100 / Math.max(rowsNeeded + 1.6, 8.5);
  const noteHeight = Math.min(pitch * 1.45, 11);

  return (
    <div className="flex h-full flex-col justify-center gap-[2.4vh]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="stage-eyebrow text-ink-3">Your team has received an unexpected</p>
          <p className="display-tight tnum mt-[0.4vh] text-[clamp(3rem,7.5vw,9rem)] text-money">
            $10,000
          </p>
          <p className="mt-[0.8vh] text-[clamp(1rem,2vw,2.4rem)] font-bold text-ink">
            You can invest in <span className="text-money">only two</span> things.
          </p>
        </div>

        {!revealed && (
          <p className="tnum text-[clamp(0.95rem,1.5vw,1.7rem)] font-semibold text-ink-3">
            <CountUp value={counts.responses} /> of {counts.total} have decided
          </p>
        )}
      </div>

      <div className="grid flex-1 grid-cols-3 gap-[1.2vw] lg:grid-cols-6">
        {options.map((option, index) => {
          const count = countFor.get(option.id) ?? 0;
          const tally = results?.options.find((o) => o.optionId === option.id);
          const pct = tally?.pct ?? 0;
          const dollars = Math.round((pct / 100) * POT);

          return (
            <div
              key={option.id}
              className="flex min-h-0 flex-col overflow-hidden rounded-[1vw] bg-surface shadow-lift ring-1 ring-ink/10 ring-inset"
            >
              {/* The well the notes land in. */}
              <div className="relative min-h-0 flex-1 overflow-hidden bg-paper-2/70">
                <span
                  className="absolute inset-x-0 bottom-0 h-px bg-ink/12"
                  aria-hidden="true"
                />
                {Array.from({ length: count }).map((_, i) => (
                  <Banknote
                    key={i}
                    row={Math.floor(i / PER_ROW)}
                    col={i % PER_ROW}
                    pitch={pitch}
                    height={noteHeight}
                    index={i}
                    reduce={Boolean(reduce)}
                  />
                ))}
              </div>

              <div className="border-t border-ink/10 px-[0.6vw] py-[1.1vh] text-center">
                <span className="block text-[clamp(1rem,1.7vw,2rem)]" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="mt-[0.4vh] block text-[clamp(0.62rem,0.9vw,1.05rem)] leading-tight font-bold text-balance text-ink-2">
                  {option.label}
                </span>

                <AnimatePresence>
                  {revealed && (
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + index * 0.08, duration: 0.5, ease: EASE_SOFT }}
                      className="mt-[0.9vh] block"
                    >
                      <span className="tnum block text-[clamp(1.4rem,2.6vw,3.1rem)] leading-none font-black text-money">
                        $<CountUp value={dollars} duration={1.4} />
                      </span>
                      <span className="tnum mt-[0.3vh] block text-[clamp(0.7rem,1vw,1.2rem)] font-bold text-money-deep">
                        <CountUp value={Math.round(pct)} suffix="%" duration={1.2} />
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-[6vh] items-center justify-between gap-6">
        <p className="tnum text-[clamp(0.75rem,1.05vw,1.2rem)] font-semibold text-ink-3">
          {totalSelections} {totalSelections === 1 ? "note" : "notes"} placed
        </p>

        <AnimatePresence>
          {revealed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.2 }}
              className="display-loose flex-1 text-right text-[clamp(1.2rem,2.6vw,3rem)] text-balance text-money"
            >
              <KineticPhrase
                text="Where we put our money says something about what we value."
                delay={1.3}
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * A stylised banknote: green field, engraved-looking inner frame, and a pale
 * medallion where a portrait would sit.
 *
 * Deliberately not a photoreal note — a flat token reads instantly at projector
 * size, and a convincing replica of real currency is not something to render on
 * a wall. It just has to say "money" from thirty feet away.
 */
function Banknote({
  row,
  col,
  pitch,
  height,
  index,
  reduce,
}: {
  row: number;
  col: number;
  pitch: number;
  height: number;
  index: number;
  reduce: boolean;
}) {
  // Stable per-note jitter, derived from the index so it never re-rolls: a
  // stack of perfectly aligned rectangles looks like a chart, not like cash.
  const jitter = useMemo(() => {
    const seed = Math.sin(index * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    return { x: (frac - 0.5) * 4, rot: (frac - 0.5) * 7 };
  }, [index]);

  return (
    <motion.span
      className="absolute"
      style={{
        left: `${col * 50 + 2 + jitter.x}%`,
        width: "46%",
        height: `${height}%`,
        bottom: `${row * pitch + 2}%`,
      }}
      initial={
        reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: "-700%", rotate: jitter.rot * 3 }
      }
      animate={{ opacity: 1, y: 0, rotate: jitter.rot }}
      transition={reduce ? { duration: 0 } : { ...springDrop, delay: Math.min(0.4, index * 0.012) }}
      aria-hidden="true"
    >
      <span
        className="relative block h-full w-full rounded-xs"
        style={{
          background: "linear-gradient(160deg, var(--color-money-lift), var(--color-money))",
          boxShadow: "0 1px 3px rgb(12 13 18 / 0.28)",
        }}
      >
        {/* Engraved border */}
        <span
          className="absolute inset-[12%] rounded-[1px]"
          style={{ border: "1px solid rgb(255 255 255 / 0.42)" }}
        />
        {/* Portrait medallion */}
        <span
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: "26%",
            height: "56%",
            transform: "translate(-50%, -50%)",
            background: "rgb(255 255 255 / 0.30)",
          }}
        />
        {/* Corner denominations */}
        <span
          className="absolute top-[14%] left-[16%] leading-none font-black"
          style={{ fontSize: "min(0.5rem, 34%)", color: "rgb(255 255 255 / 0.85)" }}
        >
          $
        </span>
        <span
          className="absolute right-[16%] bottom-[14%] leading-none font-black"
          style={{ fontSize: "min(0.5rem, 34%)", color: "rgb(255 255 255 / 0.85)" }}
        >
          $
        </span>
      </span>
    </motion.span>
  );
}
