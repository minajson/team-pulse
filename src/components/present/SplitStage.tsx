"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { LiveAnswerMeter } from "./LiveAnswerMeter";
import type { Question } from "@/lib/content/session-plan";
import { cn } from "@/lib/cn";
import {
  BarGrow,
  CountUp,
  EASE_SOFT,
  KineticPhrase,
  slideUp,
  stagger,
} from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { LiveCounts, Phase, QuestionResults } from "@/lib/types";

/**
 * Round 2. The whole round exists to make one thing visible: the room and the
 * remote half of the team are looking at the same question from different
 * chairs. So the two sides are given equal weight and equal space, and the
 * verdict lands as a headline rather than a footnote.
 */
export function SplitStage({
  question,
  results,
  phase,
  counts,
  commentary,
}: {
  question: Question;
  results: QuestionResults | null;
  phase: Phase;
  counts: LiveCounts;
  commentary: boolean;
}) {
  const revealed = phase === "revealed" || phase === "discuss";
  const options = question.options ?? [];
  const split = results?.split ?? null;
  const verdict = revealed && commentary ? (split?.verdict ?? "insufficient") : "insufficient";
  const { play } = useSound();

  useEffect(() => {
    if (!revealed || !commentary) return;
    if (verdict === "disagree") play("disagree");
    else if (verdict === "agree") play("align");
  }, [revealed, commentary, verdict, play]);

  return (
    <div className="flex h-full flex-col justify-center gap-[2.6vh]">
      <div>
        <p className="stage-eyebrow text-amber-deep">Room vs Online</p>
        <h1
          className={cn(
            "display-loose mt-[1vh] text-balance text-ink",
            revealed ? "text-[clamp(1.4rem,2.8vw,3.1rem)]" : "text-[clamp(2rem,4.4vw,5.2rem)]",
          )}
        >
          {question.prompt}
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="voting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="flex flex-1 items-center justify-center"
          >
            <LiveAnswerMeter counts={counts} />
          </motion.div>
        ) : (
          <motion.div
            key="results"
            variants={stagger(0.1, 0.12)}
            initial="hidden"
            animate="show"
            className="grid gap-[2.5vw] lg:grid-cols-2"
          >
            <SideColumn
              variants={slideUp}
              icon="🏢"
              label="In the room"
              accent="var(--color-cobalt)"
              accentDeep="var(--color-cobalt-deep)"
              sampleSize={results?.roomResponses ?? 0}
              options={options.map((option) => {
                const tally = results?.options.find((o) => o.optionId === option.id);
                return { id: option.id, label: option.label, pct: tally?.roomPct ?? 0 };
              })}
            />
            <SideColumn
              variants={slideUp}
              icon="💻"
              label="Online"
              accent="var(--color-amber-deep)"
              accentDeep="var(--color-amber)"
              sampleSize={results?.onlineResponses ?? 0}
              options={options.map((option) => {
                const tally = results?.options.find((o) => o.optionId === option.id);
                return { id: option.id, label: option.label, pct: tally?.onlinePct ?? 0 };
              })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[9vh]">
        <AnimatePresence mode="wait">
          {phase === "discuss" && question.discussPrompt ? (
            <motion.p
              key="discuss"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="display-loose text-[clamp(1.3rem,2.6vw,2.9rem)] text-balance text-amber-deep"
            >
              <KineticPhrase text={question.discussPrompt} />
            </motion.p>
          ) : verdict === "disagree" ? (
            <Verdict
              key="disagree"
              text="We don't agree"
              emoji="👀"
              detail={
                split
                  ? `A ${Math.round(split.maxGap)}-point gap between the room and online.`
                  : undefined
              }
              tone="amber"
            />
          ) : verdict === "agree" ? (
            <Verdict
              key="agree"
              text="Great minds…"
              detail="The room and online landed in the same place."
              tone="positive"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SideColumn({
  icon,
  label,
  accent,
  accentDeep,
  options,
  sampleSize,
  variants,
}: {
  icon: string;
  label: string;
  accent: string;
  accentDeep: string;
  options: { id: string; label: string; pct: number }[];
  sampleSize: number;
  variants: typeof slideUp;
}) {
  return (
    <motion.div
      variants={variants}
      className="rounded-[1.6vw] bg-surface p-[1.8vw] shadow-lift ring-1 ring-ink/10 ring-inset"
    >
      <p className="flex items-baseline gap-2 text-[clamp(1rem,1.7vw,2rem)] font-black text-ink">
        <span aria-hidden="true">{icon}</span>
        {label}
        <span className="tnum ml-auto text-[clamp(0.75rem,1.05vw,1.15rem)] font-semibold text-ink-3">
          {sampleSize} {sampleSize === 1 ? "answer" : "answers"}
        </span>
      </p>

      <ul className="mt-[2vh] flex flex-col gap-[1.8vh]">
        {options.map((option, i) => (
          <li key={option.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[clamp(0.85rem,1.3vw,1.5rem)] leading-snug font-semibold text-balance text-ink-2">
                {option.label}
              </p>
              <span
                className="tnum shrink-0 text-[clamp(1.8rem,3.4vw,4.2rem)] leading-none font-black"
                style={{ color: accent }}
              >
                <CountUp value={Math.round(option.pct)} suffix="%" duration={1.2} />
              </span>
            </div>
            <div
              className="mt-[0.6vh] overflow-hidden rounded-full bg-ink/8"
              style={{ height: "clamp(12px,1.9vh,26px)" }}
            >
              <BarGrow
                pct={option.pct}
                delay={0.2 + i * 0.1}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${accentDeep}, ${accent})` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Verdict({
  text,
  emoji,
  detail,
  tone,
}: {
  text: string;
  emoji?: string;
  detail?: string;
  tone: "amber" | "positive";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: 1.25, duration: 0.65, ease: EASE_SOFT }}
    >
      <p
        className={cn(
          "display-tight text-[clamp(2rem,5.2vw,6rem)]",
          tone === "amber" ? "text-amber-deep" : "text-positive-deep",
        )}
      >
        <KineticPhrase text={text} delay={1.35} step={0.09} />
        {/*
          Kept out of the word-splitter: at display sizes an emoji glyph paints
          wider than the inline box it is measured into, and would collide with
          the last word.
        */}
        {emoji && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.95, duration: 0.5, ease: EASE_SOFT }}
            className="ml-[0.35em] inline-block align-middle text-[0.8em]"
            aria-hidden="true"
          >
            {emoji}
          </motion.span>
        )}
      </p>
      {detail && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="mt-[0.8vh] text-[clamp(0.85rem,1.25vw,1.4rem)] font-semibold text-ink-3"
        >
          {detail}
        </motion.p>
      )}
    </motion.div>
  );
}
