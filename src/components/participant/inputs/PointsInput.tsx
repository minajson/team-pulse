"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Question } from "@/lib/content/session-plan";
import { useSound } from "@/lib/sound/SoundProvider";

const STEP = 1;

/**
 * Allocate exactly 100 points across eight values.
 *
 * The slider's maximum is capped at "what you have left plus what this row
 * already holds", so the total can never exceed 100 and the remaining counter
 * only ever moves toward zero. That removes the entire class of "you're at
 * 137, now fix it" errors that make this interaction miserable on a phone.
 */
export function PointsInput({
  question,
  initial,
  disabled,
  onSubmit,
}: {
  question: Question;
  initial: Record<string, number> | null;
  disabled: boolean;
  onSubmit: (points: Record<string, number>) => void;
}) {
  const values = useMemo(() => question.values ?? [], [question.values]);
  const total = question.selection.mode === "points" ? question.selection.total : 100;

  const blank = useMemo(
    () => Object.fromEntries(values.map((v) => [v.id, 0])) as Record<string, number>,
    [values],
  );

  const [points, setPoints] = useState<Record<string, number>>(initial ?? blank);
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
  const serverKey = initial ? JSON.stringify(initial) : "";
  const [seenKey, setSeenKey] = useState(serverKey);
  if (!dirty && initial && serverKey !== seenKey) {
    setSeenKey(serverKey);
    setPoints(initial);
  }

  const allocated = Object.values(points).reduce((a, b) => a + b, 0);
  const remaining = total - allocated;
  const complete = remaining === 0;
  const unchanged =
    complete && initial != null && values.every((v) => (initial[v.id] ?? 0) === points[v.id]);

  const setValue = (id: string, next: number) => {
    setDirty(true);
    setPoints((current) => {
      const ceiling = total - (allocated - (current[id] ?? 0));
      const clamped = Math.max(0, Math.min(ceiling, Math.round(next)));
      if (clamped === current[id]) return current;
      play("select", 60);
      return { ...current, [id]: clamped };
    });
  };

  /** Spreads what is left across the rows, largest-first for the remainder. */
  const autoBalance = () => {
    setDirty(true);
    setPoints((current) => {
      const left = total - Object.values(current).reduce((a, b) => a + b, 0);
      if (left === 0) return current;
      const next = { ...current };
      const share = Math.floor(left / values.length);
      let rest = left - share * values.length;
      for (const v of values) {
        next[v.id] = Math.max(0, next[v.id] + share);
      }
      // Hand the remainder out one point at a time, biggest allocations first.
      const order = [...values].sort((a, b) => next[b.id] - next[a.id]);
      let i = 0;
      while (rest > 0) {
        next[order[i % order.length].id] += 1;
        rest -= 1;
        i += 1;
      }
      play("submit");
      return next;
    });
  };

  const clear = () => {
    setDirty(true);
    setPoints(blank);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "sticky top-[5.5rem] z-10 flex items-center justify-between gap-3 rounded-2xl px-5 py-3 shadow-lift ring-1 ring-inset transition-colors duration-300",
          complete
            ? "bg-positive-wash text-positive-deep ring-positive/30"
            : "bg-surface text-ink ring-ink/10",
        )}
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-semibold">
          {complete ? "All 100 points placed" : "Points left to place"}
        </span>
        <motion.span
          key={remaining}
          initial={{ scale: 1.25 }}
          animate={{ scale: 1 }}
          className="tnum text-3xl font-black"
        >
          {remaining}
        </motion.span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {values.map((value) => {
          const current = points[value.id] ?? 0;
          const accent = `hsl(${value.hue} 74% 48%)`;
          const share = total > 0 ? (current / total) * 100 : 0;

          return (
            <li
              key={value.id}
              className="rounded-2xl bg-surface px-4 py-3 shadow-lift ring-1 ring-ink/10 ring-inset"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-bold text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  {value.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <StepButton
                    label={`Remove a point from ${value.label}`}
                    onClick={() => setValue(value.id, current - 5)}
                    disabled={disabled || current === 0}
                  >
                    −
                  </StepButton>
                  <span className="tnum w-9 text-center text-xl font-black text-ink">{current}</span>
                  <StepButton
                    label={`Add a point to ${value.label}`}
                    onClick={() => setValue(value.id, current + 5)}
                    disabled={disabled || remaining === 0}
                  >
                    +
                  </StepButton>
                </span>
              </div>

              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-ink/8">
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{ width: `${share}%`, background: accent }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  // Always the full budget, never the remaining budget: with a
                  // shrinking max the thumb jumps to the far right whenever a
                  // row holds everything that is left, which reads as "100%"
                  // next to a bar showing 12%. Over-allocation is prevented in
                  // the handler instead, so the thumb simply stops moving.
                  max={total}
                  step={STEP}
                  value={current}
                  disabled={disabled}
                  onChange={(e) => setValue(value.id, Number(e.target.value))}
                  aria-label={`${value.label} points`}
                  // Just the value. How many points are left is announced by
                  // the live region above, so repeating it on all eight
                  // sliders would only add noise.
                  aria-valuetext={`${current} of ${total} points`}
                  className="tp-range relative h-8 w-full cursor-pointer"
                  style={{ color: accent }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={autoBalance} disabled={disabled || complete}>
          Spread the rest evenly
        </Button>
        <Button variant="ghost" size="sm" onClick={clear} disabled={disabled || allocated === 0}>
          Clear
        </Button>
      </div>

      <div className="safe-bottom sticky bottom-0 -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-5 pb-2">
        <Button
          size="lg"
          block
          disabled={disabled || !complete || unchanged}
          onClick={() => {
            setDirty(false);
            onSubmit(points);
          }}
        >
          {unchanged
            ? "Locked in"
            : complete
              ? "Submit our team DNA"
              : `${remaining} points still to place`}
        </Button>
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/6 text-lg font-black text-ink-2 transition hover:bg-ink/12 hover:text-ink disabled:opacity-35"
    >
      {children}
    </button>
  );
}
