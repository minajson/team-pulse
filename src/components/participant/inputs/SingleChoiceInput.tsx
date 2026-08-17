"use client";

import { motion } from "framer-motion";
import type { Question } from "@/lib/content/session-plan";
import { cn } from "@/lib/cn";
import { slideUp, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";

/**
 * One tap answers the question — no separate submit button. Tapping a
 * different option changes the answer while voting is open, which is what
 * people actually do when they read all four choices after picking one.
 */
export function SingleChoiceInput({
  question,
  selected,
  disabled,
  onSelect,
}: {
  question: Question;
  selected: string[];
  disabled: boolean;
  onSelect: (optionId: string) => void;
}) {
  const { play } = useSound();
  const options = question.options ?? [];

  return (
    <motion.ul
      variants={stagger(0.05, 0.055)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
      aria-labelledby={`question-${question.id}`}
      role="radiogroup"
    >
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <motion.li key={option.id} variants={slideUp}>
            <button
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                play("select");
                onSelect(option.id);
              }}
              className={cn(
                "group flex w-full items-start gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-250",
                "min-h-[4.25rem] shadow-lift ring-1 ring-inset",
                "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100",
                active
                  ? "bg-cobalt-wash ring-2 ring-cobalt"
                  : "bg-surface ring-ink/10 hover:ring-ink/25",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black transition",
                  active ? "bg-cobalt text-white" : "bg-ink/6 text-ink-2",
                )}
                aria-hidden="true"
              >
                {option.emoji ?? option.marker}
              </span>
              <span
                className={cn(
                  "flex-1 text-[1.02rem] leading-snug font-semibold text-balance",
                  active ? "text-cobalt-deep" : "text-ink",
                )}
              >
                {option.label}
              </span>
              {active && (
                <motion.span
                  layoutId={`check-${question.id}`}
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cobalt text-white"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={4}>
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              )}
            </button>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
