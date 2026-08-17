"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useMultiSelect } from "@/lib/client/useMultiSelect";
import type { Question } from "@/lib/content/session-plan";
import { slideUp, springSnappy, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";

/**
 * The $10,000 round — pick exactly two places to invest.
 *
 * A third tap is refused with a message rather than silently replacing an
 * earlier pick. Quietly dropping a choice someone deliberately made is worse
 * than a moment of friction: they would not notice until after submitting, and
 * the recorded answer would not be the one they thought they gave.
 */
export function PickTwoInput({
  question,
  selected,
  disabled,
  onSubmit,
}: {
  question: Question;
  selected: string[];
  disabled: boolean;
  onSubmit: (optionIds: string[]) => void;
}) {
  const { play } = useSound();
  const sel = useMultiSelect(question, selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-money-wash px-5 py-4 text-center ring-1 ring-money/25 ring-inset">
        <p className="display-tight tnum text-4xl text-money">$10,000</p>
        <p className="mt-1 text-sm font-semibold text-money-deep" role="status" aria-live="polite">
          {sel.counterLabel}
        </p>
      </div>

      <motion.ul
        variants={stagger(0.04, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2"
        role="group"
        aria-labelledby={`question-${question.id}`}
      >
        {(question.options ?? []).map((option) => {
          const active = sel.isPicked(option.id);
          return (
            <motion.li key={option.id} variants={slideUp}>
              <motion.button
                aria-pressed={active}
                disabled={disabled}
                onClick={() => {
                  play(active ? "select" : "moneyFlick");
                  sel.toggle(option.id);
                }}
                animate={active ? { scale: 1.015 } : { scale: 1 }}
                transition={springSnappy}
                className={cn(
                  "relative flex min-h-[5.5rem] w-full flex-col justify-center gap-1 overflow-hidden rounded-2xl px-5 py-4 text-left",
                  "shadow-lift ring-1 ring-inset transition-colors duration-250",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                  active
                    ? "bg-money-wash ring-2 ring-money"
                    : "bg-surface ring-ink/10 hover:ring-ink/25",
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {option.emoji}
                </span>
                <span
                  className={cn(
                    "text-[0.98rem] leading-snug font-semibold text-balance",
                    active ? "text-money-deep" : "text-ink",
                  )}
                >
                  {option.label}
                </span>

                <AnimatePresence>
                  {active && (
                    <motion.span
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={springSnappy}
                      className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-money text-sm font-black text-white"
                      aria-hidden="true"
                    >
                      $
                    </motion.span>
                  )}
                </AnimatePresence>
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
          variant="money"
          disabled={disabled || !sel.complete || sel.unchanged}
          onClick={() => {
            sel.markSubmitted();
            onSubmit(sel.picks);
          }}
        >
          {sel.unchanged
            ? "Locked in"
            : sel.complete
              ? "Invest the $10,000"
              : `Pick ${sel.max - sel.picks.length} more`}
        </Button>
      </div>
    </div>
  );
}
