"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Question } from "@/lib/content/session-plan";
import { slideUp, springSnappy, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";

/**
 * The $10,000 round. Selection is capped at two: picking a third replaces the
 * oldest choice rather than showing an error, because being told "no" after a
 * tap is worse than the app quietly doing the obvious thing.
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
  const need = question.selectCount ?? 2;
  const [picks, setPicks] = useState<string[]>(selected);
  const [dirty, setDirty] = useState(false);
  const { play } = useSound();

  /*
   * Reconciling server state into local edit state during render, rather than
   * in an effect. This is the documented way to derive state from props: the
   * effect version renders once with a stale value and then again with the
   * fresh one, and on a reveal that shows as a visible flicker.
   *
   * `dirty` means "this participant is mid-change", and their in-progress edit
   * always wins over an incoming frame.
   */
  const serverKey = selected.join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (!dirty && serverKey !== seenKey) {
    setSeenKey(serverKey);
    setPicks(selected);
  }

  const toggle = (id: string) => {
    setDirty(true);
    setPicks((current) => {
      if (current.includes(id)) {
        play("select");
        return current.filter((x) => x !== id);
      }
      play("moneyFlick");
      const next = [...current, id];
      return next.length > need ? next.slice(next.length - need) : next;
    });
  };

  const complete = picks.length === need;
  const unchanged =
    complete && picks.length === selected.length && picks.every((p) => selected.includes(p));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-money-wash px-5 py-4 text-center ring-1 ring-money/25 ring-inset">
        <p className="display-tight tnum text-4xl text-money">$10,000</p>
        <p className="mt-1 text-sm font-semibold text-money-deep">
          Choose {need}. {picks.length}/{need} selected.
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
          const active = picks.includes(option.id);
          return (
            <motion.li key={option.id} variants={slideUp}>
              <motion.button
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggle(option.id)}
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

      <div className="safe-bottom sticky bottom-0 -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-5 pb-2">
        <Button
          size="lg"
          block
          variant="money"
          disabled={disabled || !complete || unchanged}
          onClick={() => {
            setDirty(false);
            onSubmit(picks);
          }}
        >
          {unchanged
            ? "Locked in"
            : complete
              ? "Invest the $10,000"
              : `Pick ${need - picks.length} more`}
        </Button>
      </div>
    </div>
  );
}
