"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LiveAnswerMeter } from "./LiveAnswerMeter";
import type { Question } from "@/lib/content/session-plan";
import { cn } from "@/lib/cn";
import { BarGrow, CountUp, KineticPhrase, slideUp, stagger } from "@/lib/motion/primitives";
import type { LiveCounts, Phase, QuestionResults } from "@/lib/types";

/**
 * Rounds 1 and the final round's first question.
 *
 * Nothing is ever labelled correct — the leading answer is given warmth
 * (amber) rather than a tick, and the wording around it stays descriptive.
 */
export function ChoiceStage({
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
  const options = question.options ?? [];
  const dense = options.length > 6;

  const tallies = options.map((option) => ({
    option,
    tally: results?.options.find((o) => o.optionId === option.id) ?? null,
  }));
  const leader = revealed
    ? tallies.reduce<string | null>((best, t) => {
        if (!t.tally) return best;
        const bestPct = tallies.find((x) => x.option.id === best)?.tally?.pct ?? -1;
        return t.tally.pct > bestPct ? t.option.id : best;
      }, null)
    : null;

  return (
    <div className="flex h-full flex-col justify-center gap-[3vh]">
      <div>
        {question.kicker && <p className="stage-eyebrow text-amber-deep">{question.kicker}</p>}
        <h1
          className={cn(
            "display-loose text-balance text-ink",
            revealed
              ? "text-[clamp(1.5rem,3.1vw,3.4rem)]"
              : "text-[clamp(2rem,4.6vw,5.4rem)]",
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
            transition={{ duration: 0.4 }}
            className="flex flex-1 items-center justify-center"
          >
            <LiveAnswerMeter counts={counts} />
          </motion.div>
        ) : (
          <motion.ul
            key="results"
            variants={stagger(0.12, 0.09)}
            initial="hidden"
            animate="show"
            className={cn(
              "flex flex-1 flex-col justify-center",
              dense ? "gap-[1.1vh]" : "gap-[2vh]",
            )}
          >
            {tallies.map(({ option, tally }, index) => {
              const pct = tally?.pct ?? 0;
              const isLeader = option.id === leader && pct > 0;

              return (
                <motion.li key={option.id} variants={slideUp}>
                  <div className="flex items-center gap-[1.4vw]">
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-full font-black transition-colors duration-500",
                        isLeader ? "bg-amber text-ink" : "bg-ink/8 text-ink-2",
                      )}
                      style={{
                        width: dense ? "clamp(1.6rem,2.4vw,2.6rem)" : "clamp(2rem,3.2vw,3.6rem)",
                        height: dense ? "clamp(1.6rem,2.4vw,2.6rem)" : "clamp(2rem,3.2vw,3.6rem)",
                        fontSize: dense ? "clamp(0.7rem,1.1vw,1.2rem)" : "clamp(0.9rem,1.5vw,1.7rem)",
                      }}
                      aria-hidden="true"
                    >
                      {option.emoji ?? option.marker}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate font-bold transition-colors duration-500",
                          isLeader ? "text-ink" : "text-ink-2",
                        )}
                        style={{
                          fontSize: dense
                            ? "clamp(0.85rem,1.35vw,1.5rem)"
                            : "clamp(1rem,1.8vw,2.1rem)",
                        }}
                      >
                        {option.label}
                      </p>
                      <div
                        className="mt-[0.5vh] overflow-hidden rounded-full bg-ink/8"
                        style={{ height: dense ? "clamp(8px,1.1vh,14px)" : "clamp(12px,1.8vh,24px)" }}
                      >
                        <BarGrow
                          pct={pct}
                          delay={0.15 + index * 0.09}
                          className="h-full rounded-full"
                          style={{
                            background: isLeader
                              ? "linear-gradient(90deg, var(--color-amber-deep), var(--color-amber))"
                              : "linear-gradient(90deg, var(--color-cobalt-deep), var(--color-cobalt))",
                          }}
                        />
                      </div>
                    </div>

                    <span
                      className={cn(
                        "tnum shrink-0 text-right font-black tabular-nums transition-colors duration-500",
                        isLeader ? "text-amber-deep" : "text-ink-2",
                      )}
                      style={{
                        fontSize: dense ? "clamp(1rem,1.8vw,2rem)" : "clamp(1.4rem,2.8vw,3.4rem)",
                        minWidth: "3.6ch",
                      }}
                    >
                      <CountUp value={Math.round(pct)} suffix="%" duration={1.2} />
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      {/*
       * No automated commentary here. The result is the conversation starter;
       * software reacting to people's answers ("Interesting…") adds nothing and
       * reads as the app having an opinion about what the room chose.
       *
       * The discussion prompt is different — it is the facilitator's question,
       * shown only when they deliberately switch to discuss mode.
       */}
      <AnimatePresence>
        {phase === "discuss" && question.discussPrompt && (
          <motion.p
            key="discuss"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="display-loose text-[clamp(1.3rem,2.7vw,3rem)] text-balance text-amber-deep"
          >
            <KineticPhrase text={question.discussPrompt} />
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
