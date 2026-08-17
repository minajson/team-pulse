"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { floatIn, springSnappy } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { WallItem } from "@/lib/types";

/**
 * The phone-side of the response wall. Hearts only — there is no way to vote
 * something down, because the point of the round is to find what the team
 * agrees is worth saying, not to run a popularity cull.
 */
export function WallList({
  items,
  onReact,
}: {
  items: WallItem[];
  onReact: (responseId: string) => void;
}) {
  const { play } = useSound();
  if (items.length === 0) return null;

  return (
    <section className="pb-6">
      <h2 className="eyebrow mb-3 text-ink-3">What the team is saying</h2>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              variants={floatIn}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={springSnappy}
            >
              <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lift ring-1 ring-ink/10 ring-inset">
                <p className="flex-1 leading-snug font-semibold text-ink">{item.text}</p>
                <button
                  onClick={() => {
                    if (!item.hearted) play("heart");
                    onReact(item.id);
                  }}
                  aria-pressed={item.hearted}
                  aria-label={
                    item.hearted
                      ? `Remove your heart from "${item.text}". ${item.hearts} hearts.`
                      : `Heart "${item.text}". ${item.hearts} hearts.`
                  }
                  className={cn(
                    "flex h-11 min-w-[3.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition",
                    item.hearted
                      ? "bg-alert/12 text-alert-deep"
                      : "bg-ink/6 text-ink-3 hover:bg-ink/12 hover:text-ink-2",
                  )}
                >
                  <motion.span
                    animate={item.hearted ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                    transition={{ duration: 0.36 }}
                    aria-hidden="true"
                  >
                    {item.hearted ? "❤️" : "🤍"}
                  </motion.span>
                  <span className="tnum">{item.hearts}</span>
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
