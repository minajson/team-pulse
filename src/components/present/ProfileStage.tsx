"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Question } from "@/lib/content/session-plan";
import { CountUp, EASE_SOFT, KineticPhrase, springSoft } from "@/lib/motion/primitives";
import type { LiveCounts, Phase, QuestionResults } from "@/lib/types";

/**
 * Round 3. The most-chosen card recedes rather than being crossed out: the
 * team is looking at a decision it made, not a person it got wrong. Every
 * card keeps its percentage, so the runners-up stay part of the conversation.
 */
export function ProfileStage({
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
  const profiles = question.profiles ?? [];

  const topId = revealed
    ? (results?.options.reduce<{ id: string; pct: number } | null>((best, o) => {
        if (!best || o.pct > best.pct) return { id: o.optionId, pct: o.pct };
        return best;
      }, null)?.id ?? null)
    : null;

  return (
    <div className="flex h-full flex-col justify-center gap-[2.4vh]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          <p className="stage-eyebrow text-amber-deep">{question.kicker}</p>
          <h1 className="display-tight mt-[0.8vh] text-[clamp(1.8rem,4.2vw,5rem)] text-ink">
            {question.prompt}
          </h1>
        </div>
        {!revealed && (
          <p className="text-[clamp(0.9rem,1.4vw,1.6rem)] font-semibold text-ink-3">
            You can take only <span className="text-ink">three</span>.
          </p>
        )}
      </div>

      <div className="grid flex-1 grid-cols-2 items-stretch gap-[1.4vw] lg:grid-cols-4">
        {profiles.map((profile, index) => {
          const tally = results?.options.find((o) => o.optionId === profile.id);
          const pct = tally?.pct ?? 0;
          const isTop = profile.id === topId && pct > 0;
          const accent = `hsl(${profile.hue} 72% 42%)`;

          return (
            <motion.article
              key={profile.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{
                opacity: revealed && isTop ? 0.55 : 1,
                y: revealed && isTop ? 12 : 0,
                scale: revealed && isTop ? 0.97 : 1,
              }}
              transition={{ ...springSoft, delay: revealed ? 0.15 : index * 0.08 }}
              className="relative flex flex-col overflow-hidden rounded-[1.4vw] bg-surface p-[1.5vw] shadow-lift ring-1 ring-ink/10 ring-inset"
            >
              <span
                className="absolute inset-x-0 top-0 h-[0.5vh]"
                style={{ background: accent }}
                aria-hidden="true"
              />

              <h2 className="text-[clamp(1.3rem,2.6vw,3rem)] leading-none font-black text-ink">
                {profile.name}
              </h2>
              <p
                className="stage-eyebrow mt-[0.8vh]"
                style={{ color: accent }}
              >
                {profile.title}
              </p>

              <ul className="mt-[1.6vh] flex flex-1 flex-col gap-[0.8vh]">
                {profile.traits.map((trait) => (
                  <li
                    key={trait}
                    className="flex gap-2 text-[clamp(0.72rem,1.05vw,1.2rem)] leading-snug text-ink-2"
                  >
                    <span
                      className="mt-[0.55em] h-[0.35em] w-[0.35em] shrink-0 rounded-full"
                      style={{ background: accent }}
                      aria-hidden="true"
                    />
                    {trait}
                  </li>
                ))}
              </ul>

              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.55, ease: EASE_SOFT }}
                    className="mt-[1.6vh] border-t border-ink/10 pt-[1.2vh]"
                  >
                    <p
                      className="tnum text-[clamp(1.6rem,3.4vw,4rem)] leading-none font-black"
                      style={{ color: isTop ? "var(--color-amber-deep)" : accent }}
                    >
                      <CountUp value={Math.round(pct)} suffix="%" duration={1.3} />
                    </p>
                    <p className="mt-[0.4vh] text-[clamp(0.68rem,0.95vw,1.05rem)] font-semibold text-ink-3">
                      left behind
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>

      <div className="min-h-[7vh]">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="meter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <p className="tnum text-[clamp(1.1rem,2vw,2.2rem)] font-bold text-ink-2">
                <CountUp value={counts.responses} /> of {counts.total} have chosen
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.1 }}
              className="display-loose text-[clamp(1.3rem,2.8vw,3.1rem)] text-balance text-amber-deep"
            >
              <KineticPhrase
                text={question.discussPrompt ?? "Why did we leave this person behind?"}
                delay={1.2}
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
