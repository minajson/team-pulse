"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Question } from "@/lib/content/session-plan";
import { wordCount } from "@/lib/security/text";
import type { ModerationStatus } from "@/lib/types";

/**
 * Six words, no more. The constraint is the feature — it forces a sentence
 * that can be read from the back of a room and stops anyone writing an essay
 * nobody will project.
 */
export function OpenTextInput({
  question,
  initial,
  moderation,
  disabled,
  onSubmit,
}: {
  question: Question;
  initial: string;
  moderation: ModerationStatus | null;
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const max = question.maxWords ?? 6;
  const [text, setText] = useState(initial);
  const [dirty, setDirty] = useState(false);

  /*
   * Reconciling server state into local edit state during render, rather than
   * in an effect. This is the documented way to derive state from props: the
   * effect version renders once with a stale value and then again with the
   * fresh one, and on a reveal that shows as a visible flicker.
   *
   * `dirty` means "this participant is mid-change", and their in-progress edit
   * always wins over an incoming frame.
   */
  const [seenInitial, setSeenInitial] = useState(initial);
  if (!dirty && initial !== seenInitial) {
    setSeenInitial(initial);
    setText(initial);
  }

  const words = wordCount(text);
  const over = words > max;
  const valid = words > 0 && !over;
  const unchanged = valid && text.trim() === initial.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
        <p className="serif-accent text-xl leading-snug text-ink-2">{question.textPrefix}</p>

        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setDirty(true);
            setText(e.target.value.replace(/\n/g, " "));
          }}
          rows={2}
          maxLength={120}
          placeholder="listened to each other more"
          aria-label={`Complete the sentence in ${max} words or fewer`}
          aria-invalid={over}
          className={cn(
            "mt-3 w-full resize-none border-0 bg-transparent text-2xl leading-snug font-bold text-ink outline-none",
            "placeholder:font-normal placeholder:text-ink-3",
          )}
        />

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/8 pt-3">
          <span
            className={cn(
              "text-sm font-semibold",
              over ? "text-alert-deep" : words === 0 ? "text-ink-3" : "text-ink-2",
            )}
            role="status"
            aria-live="polite"
          >
            {over
              ? `${words - max} word${words - max === 1 ? "" : "s"} too many`
              : `${max - words} word${max - words === 1 ? "" : "s"} left`}
          </span>

          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: max }).map((_, i) => (
              <motion.span
                key={i}
                animate={{ scale: i < words ? 1 : 0.7 }}
                className={cn(
                  "h-2 w-2 rounded-full",
                  over ? "bg-alert" : i < words ? "bg-cobalt" : "bg-ink/15",
                )}
              />
            ))}
          </span>
        </div>
      </div>

      {moderation === "pending" && (
        <p className="rounded-xl bg-amber-wash px-4 py-3 text-sm font-medium text-amber-deep ring-1 ring-amber/25 ring-inset">
          Sent. Your facilitator will check it before it goes on screen.
        </p>
      )}

      <Button
        size="lg"
        block
        disabled={disabled || !valid || unchanged}
        onClick={() => {
          setDirty(false);
          onSubmit(text.trim());
        }}
      >
        {unchanged ? "Sent" : over ? `Trim to ${max} words` : "Send it"}
      </Button>
    </div>
  );
}
