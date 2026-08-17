"use client";

import { motion } from "framer-motion";
import { PulseRings } from "@/lib/motion/primitives";
import type { LiveCounts } from "@/lib/types";

type Kind = "connecting" | "lobby" | "paused" | "waiting" | "closing" | "ended";

const COPY: Record<Kind, { title: string; body: string; emoji?: string }> = {
  connecting: { title: "Connecting…", body: "Finding the room." },
  lobby: {
    title: "You're in.",
    body: "Keep this screen open — we'll start in a moment.",
  },
  paused: { title: "Just a pause.", body: "Stay with us. We'll pick this up shortly.", emoji: "⏸" },
  waiting: { title: "Hang tight.", body: "The next question is on its way." },
  closing: {
    title: "Eyes up.",
    body: "This part happens on the big screen.",
    emoji: "👀",
  },
  ended: {
    title: "That's a wrap.",
    body: "Thanks for being honest. You can close this screen.",
    emoji: "🙏",
  },
};

/**
 * The waiting states. These are on screen more than any question is, so they
 * get the same care: a living pulse, not a spinner.
 */
export function StatusScreen({ kind, counts }: { kind: Kind; counts?: LiveCounts }) {
  const copy = COPY[kind];
  const showPulse = kind === "lobby" || kind === "connecting" || kind === "waiting";

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
      <div className="relative mb-10 flex h-24 w-24 items-center justify-center">
        {showPulse && <PulseRings count={3} />}
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-cobalt text-2xl"
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {copy.emoji ? (
            <span aria-hidden="true">{copy.emoji}</span>
          ) : (
            <span className="h-3 w-3 rounded-full bg-white" aria-hidden="true" />
          )}
        </motion.div>
      </div>

      <h1 className="display-tight text-[clamp(2rem,9vw,2.75rem)]">{copy.title}</h1>
      <p className="mt-3 max-w-xs text-base leading-relaxed text-ink-2">{copy.body}</p>

      {kind === "lobby" && counts && counts.total > 0 && (
        <p className="mt-8 text-sm text-ink-3">
          <span className="tnum font-bold text-ink">{counts.total}</span> here so far
        </p>
      )}
    </div>
  );
}
