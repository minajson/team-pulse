"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { PulseField } from "@/components/visual/PulseField";
import type { ClosingScreenId } from "@/lib/content/session-plan";
import {
  BarGrow,
  CountUp,
  EASE_SOFT,
  KineticPhrase,
  slideUp,
  stagger,
} from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { SessionSummary } from "@/lib/types";

/**
 * The three closing screens and the final one, generated from the session's
 * own data — never from placeholder values.
 *
 * These are read across a room while someone talks over them, so each screen
 * leads with one number and leaves the explaining to the facilitator. The
 * language stays descriptive throughout: it reports what this room chose, and
 * never claims anything about who anyone is.
 */
export function ClosingStage({
  screen,
  summary,
}: {
  screen: ClosingScreenId;
  summary: SessionSummary | null;
}) {
  const { play } = useSound();

  useEffect(() => {
    if (screen === "final") play("finalReveal");
    else play("advance");
  }, [screen, play]);

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="serif-accent text-[clamp(1.2rem,2.6vw,2.8rem)] text-ink-3">
          Gathering what we told ourselves…
        </p>
      </div>
    );
  }

  if (screen === "values") return <ValuesScreen summary={summary} />;
  if (screen === "thinking") return <ThinkingScreen summary={summary} />;
  if (screen === "voice") return <VoiceScreen summary={summary} />;
  return <FinalScreen />;
}

function Eyebrow() {
  return <p className="stage-eyebrow text-amber-deep">What did we tell ourselves?</p>;
}

/* ------------------------------------------------------------------ */
/* Screen 1 — What we value                                            */
/* ------------------------------------------------------------------ */

function ValuesScreen({ summary }: { summary: SessionSummary }) {
  const investments = summary.values.investments.slice(0, 5);
  const dna = summary.values.dna.slice(0, 5);

  return (
    <motion.div
      variants={stagger(0.1, 0.1)}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col justify-center gap-[3vh]"
    >
      <motion.div variants={slideUp}>
        <Eyebrow />
        <h1 className="display-tight mt-[1vh] text-[clamp(2.2rem,6vw,7rem)] text-ink">
          What we value
        </h1>
      </motion.div>

      <div className="grid items-start gap-[3vw] lg:grid-cols-2">
        <motion.section variants={slideUp}>
          <h2 className="stage-eyebrow text-ink-3">Where we put the $10,000</h2>
          <ol className="mt-[2vh] flex flex-col gap-[1.8vh]">
            {investments.map((line, i) => (
              <li key={line.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[clamp(1rem,1.6vw,1.9rem)] font-bold text-ink">
                    {line.label}
                  </span>
                  {/* Money stays green wherever it appears. */}
                  <span className="tnum text-[clamp(1.2rem,2.2vw,2.6rem)] font-black text-money">
                    <CountUp value={line.pct} decimals={0} suffix="%" />
                  </span>
                </div>
                <div className="mt-[0.5vh] h-[clamp(10px,1.4vh,18px)] overflow-hidden rounded-full bg-ink/8">
                  <BarGrow
                    pct={line.pct}
                    delay={0.3 + i * 0.1}
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--color-money-deep), var(--color-money-lift))",
                    }}
                  />
                </div>
              </li>
            ))}
            {investments.length === 0 && <EmptyLine />}
          </ol>
        </motion.section>

        <motion.section variants={slideUp}>
          <h2 className="stage-eyebrow text-ink-3">What we built our team from</h2>
          <ol className="mt-[2vh] flex flex-col gap-[1.8vh]">
            {dna.map((line, i) => (
              <li key={line.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[clamp(1rem,1.6vw,1.9rem)] font-bold text-ink">
                    {line.label}
                  </span>
                  <span
                    className="tnum text-[clamp(1.2rem,2.2vw,2.6rem)] font-black"
                    style={{ color: `hsl(${line.hue} 74% 34%)` }}
                  >
                    <CountUp value={line.pct} decimals={0} suffix="%" />
                  </span>
                </div>
                <div className="mt-[0.5vh] h-[clamp(10px,1.4vh,18px)] overflow-hidden rounded-full bg-ink/8">
                  <BarGrow
                    pct={line.pct}
                    delay={0.4 + i * 0.1}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, hsl(${line.hue} 74% 30%), hsl(${line.hue} 68% 52%))`,
                    }}
                  />
                </div>
              </li>
            ))}
            {dna.length === 0 && <EmptyLine />}
          </ol>
        </motion.section>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 2 — How we think                                             */
/* ------------------------------------------------------------------ */

function ThinkingScreen({ summary }: { summary: SessionSummary }) {
  const insights = [
    summary.thinking.strongestAgreement,
    summary.thinking.biggestDivide,
    summary.thinking.decisionPattern,
  ].filter(Boolean);

  return (
    <motion.div
      variants={stagger(0.2, 0.55)}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col justify-center gap-[3.5vh]"
    >
      <motion.div variants={slideUp}>
        <Eyebrow />
        <h1 className="display-tight mt-[1vh] text-[clamp(2.2rem,6vw,7rem)] text-ink">
          How we think
        </h1>
      </motion.div>

      {insights.length === 0 ? (
        <EmptyLine />
      ) : (
        // Editorial rows rather than cards: at projector scale a boxed grid
        // reads as a dashboard, and these are three sentences, not three panels.
        <ol className="flex flex-col divide-y divide-ink/10">
          {insights.map((insight, i) => (
            <motion.li
              key={i}
              variants={slideUp}
              className="grid items-baseline gap-x-[3vw] gap-y-[0.6vh] py-[2.4vh] lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]"
            >
              {/* nowrap: "47 points" splitting across two lines reads as two
                  separate numbers for a second, which is exactly the wrong
                  moment to make the room re-read something. */}
              <span className="tnum display-tight text-[clamp(2.2rem,5vw,5.6rem)] leading-none whitespace-nowrap text-amber-deep">
                {insight!.stat}
              </span>
              <span>
                <span className="block text-[clamp(1.1rem,2.1vw,2.5rem)] leading-tight font-bold text-balance text-ink">
                  {insight!.label}
                </span>
                <span className="mt-[0.6vh] block text-[clamp(0.85rem,1.25vw,1.45rem)] leading-snug text-balance text-ink-3">
                  {insight!.question}
                </span>
              </span>
            </motion.li>
          ))}
        </ol>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 3 — Our voice                                                */
/* ------------------------------------------------------------------ */

function VoiceScreen({ summary }: { summary: SessionSummary }) {
  const statements = summary.voice.topStatements;

  return (
    <motion.div
      variants={stagger(0.15, 0.16)}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col justify-center gap-[2.5vh]"
    >
      <motion.div variants={slideUp}>
        <Eyebrow />
        <h1 className="display-tight mt-[1vh] text-[clamp(1.9rem,4.8vw,5.6rem)] text-ink">
          Our team would be stronger if we…
        </h1>
      </motion.div>

      {statements.length === 0 ? (
        <EmptyLine />
      ) : (
        <ol className="flex flex-col gap-[1.4vh]">
          {statements.map((statement, i) => {
            const hero = i === 0;
            return (
              <motion.li
                key={`${statement.text}-${i}`}
                variants={slideUp}
                className="flex items-baseline gap-[1.6vw]"
              >
                <span
                  className={
                    hero
                      ? "tnum shrink-0 text-[clamp(1.2rem,2.4vw,2.8rem)] font-black text-amber-deep"
                      : "tnum shrink-0 text-[clamp(0.95rem,1.7vw,2rem)] font-black text-ink-4"
                  }
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    hero
                      ? "display-loose flex-1 text-[clamp(1.8rem,4.4vw,5rem)] text-balance text-ink"
                      : "display-loose flex-1 text-[clamp(1.2rem,2.7vw,3.1rem)] text-balance text-ink-2"
                  }
                >
                  {statement.text}
                </span>
                {statement.hearts > 0 && (
                  <span
                    className={
                      hero
                        ? "tnum shrink-0 text-[clamp(1.1rem,2.2vw,2.6rem)] font-black text-amber-deep"
                        : "tnum shrink-0 text-[clamp(0.85rem,1.5vw,1.8rem)] font-black text-ink-3"
                    }
                  >
                    <span aria-hidden="true">❤</span> {statement.hearts}
                  </span>
                )}
              </motion.li>
            );
          })}
        </ol>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Final screen                                                        */
/* ------------------------------------------------------------------ */

function FinalScreen() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      <PulseField className="opacity-55" density={48} linkDistance={210} speed={0.7} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative flex flex-col items-center"
      >
        <h1 className="display-tight text-[clamp(2.6rem,9vw,11rem)] text-ink">
          <KineticPhrase text="Team Pulse" step={0.1} />
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.7, ease: EASE_SOFT }}
          className="mt-[3vh] flex flex-col gap-[0.3vh] text-[clamp(1rem,2.1vw,2.5rem)] font-bold text-ink-2"
        >
          <span>This is what we said.</span>
          <span>This is what we valued.</span>
          <span>This is what we chose.</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.4, duration: 0.9, ease: EASE_SOFT }}
          className="display-tight mt-[5vh] text-[clamp(2.8rem,8.5vw,9.5rem)] text-amber-deep"
        >
          One team.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.6, duration: 1.1 }}
          className="mt-[5vh] max-w-[58vw] text-[clamp(0.9rem,1.5vw,1.8rem)] leading-relaxed text-balance text-ink-2"
        >
          Great teams aren&rsquo;t built by everyone thinking alike. They&rsquo;re built by people
          who can think differently and still move forward together.
        </motion.p>
      </motion.div>
    </div>
  );
}

function EmptyLine() {
  return (
    <p className="serif-accent text-[clamp(1rem,2vw,2.2rem)] text-ink-3">
      Nothing recorded for this part of the session.
    </p>
  );
}
