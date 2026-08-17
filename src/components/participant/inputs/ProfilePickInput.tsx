"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useMultiSelect } from "@/lib/client/useMultiSelect";
import type { Question } from "@/lib/content/session-plan";
import { slideUp, springSnappy, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";

/**
 * Round 3 — build the team you would take.
 *
 * The projector asks "who stays behind?", because that is the question worth
 * discussing. The phone asks the question the participant is actually
 * answering: pick the three people you want. Asking someone to nominate a
 * person to exclude is a needlessly uncomfortable way to collect the same data,
 * and it inverts the mental model of every other pick-a-team decision they have
 * ever made.
 *
 * The one they leave out is derived at tally time, so the round's insight is
 * unchanged.
 */
export function ProfilePickInput({
  question,
  selected,
  disabled,
  onSubmit,
}: {
  question: Question;
  selected: string[];
  disabled: boolean;
  onSubmit: (profileIds: string[]) => void;
}) {
  const { play } = useSound();
  const profiles = question.profiles ?? [];
  const sel = useMultiSelect(question, selected);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "sticky top-[5.5rem] z-10 flex items-center justify-between gap-3 rounded-2xl px-5 py-3 shadow-lift ring-1 ring-inset transition-colors duration-300",
          sel.complete
            ? "bg-positive-wash text-positive-deep ring-positive/30"
            : "bg-surface text-ink ring-ink/10",
        )}
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-semibold">
          {sel.complete ? "Your team is set" : `Pick ${sel.max - sel.picks.length} more`}
        </span>
        <motion.span
          key={sel.picks.length}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="tnum text-lg font-black"
        >
          {sel.counterLabel}
        </motion.span>
      </div>

      <motion.ul
        variants={stagger(0.05, 0.07)}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2"
        role="group"
        aria-labelledby={`question-${question.id}`}
      >
        {profiles.map((profile) => {
          const active = sel.isPicked(profile.id);
          const accent = `hsl(${profile.hue} 72% 46%)`;
          const wash = `hsl(${profile.hue} 78% 97%)`;

          return (
            <motion.li key={profile.id} variants={slideUp}>
              <motion.button
                aria-pressed={active}
                disabled={disabled}
                onClick={() => {
                  play(active ? "select" : "profileSelect");
                  sel.toggle(profile.id);
                }}
                animate={active ? { y: -4 } : { y: 0 }}
                transition={springSnappy}
                style={
                  active ? { background: wash, boxShadow: `0 18px 40px -20px ${accent}` } : undefined
                }
                className={cn(
                  "relative flex h-full w-full flex-col overflow-hidden rounded-3xl px-5 py-5 text-left transition-shadow duration-300",
                  "shadow-lift ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-70",
                  active ? "ring-2" : "bg-surface ring-ink/10 hover:ring-ink/25",
                )}
              >
                <span
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ background: accent }}
                  aria-hidden="true"
                />

                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black tracking-tight text-ink">{profile.name}</span>
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={springSnappy}
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-black tracking-wider text-white uppercase"
                        style={{ background: accent }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={4}
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Chosen
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>

                <span className="eyebrow mt-1 block" style={{ color: accent }}>
                  {profile.title}
                </span>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {profile.traits.map((trait) => (
                    <li key={trait} className="flex gap-2 text-sm leading-snug text-ink-2">
                      <span
                        className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: accent }}
                        aria-hidden="true"
                      />
                      {trait}
                    </li>
                  ))}
                </ul>
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>

      <AnimatePresence>
        {sel.notice && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-amber-wash px-4 py-3 text-sm font-semibold text-amber-deep ring-1 ring-amber/30 ring-inset"
          >
            {sel.notice}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="safe-bottom sticky bottom-0 -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-5 pb-2">
        <Button
          size="lg"
          block
          disabled={disabled || !sel.complete || sel.unchanged}
          onClick={() => {
            sel.markSubmitted();
            onSubmit(sel.picks);
          }}
        >
          {sel.unchanged
            ? "Team confirmed"
            : sel.complete
              ? "Confirm team"
              : `Pick ${sel.max - sel.picks.length} more`}
        </Button>
      </div>
    </div>
  );
}
