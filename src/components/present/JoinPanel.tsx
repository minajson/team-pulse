"use client";

import { motion, useReducedMotion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { useOrigin } from "@/lib/client/browser-state";
import { EASE_SOFT } from "@/lib/motion/primitives";

/**
 * The compact join panel that sits beside an open question.
 *
 * It exists so a facilitator does not have to interrupt a live round to let a
 * latecomer in: while people are answering, the way in is simply on screen.
 * It disappears the moment results are revealed, because at that point the
 * room's attention belongs to the result and the space belongs to the chart.
 *
 * Rendered into a reserved column by StageFrame rather than floated over the
 * stage — see the note there for why.
 */
export function JoinPanel({ code }: { code: string }) {
  const origin = useOrigin();
  const reduce = useReducedMotion();

  const joinUrl = origin ? `${origin}/j/${code}` : `/j/${code}`;
  const displayUrl = origin ? `${origin.replace(/^https?:\/\//, "")}/j/${code}` : `/j/${code}`;

  return (
    <motion.aside
      // Keyed on the question upstream, so opening a new one replays the
      // single attention pulse rather than animating continuously.
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.45, ease: EASE_SOFT }}
      className="relative flex w-[clamp(9.5rem,13vw,15rem)] shrink-0 flex-col items-center self-end rounded-2xl bg-surface p-[0.9vw] shadow-lift ring-1 ring-ink/10 ring-inset"
      aria-label={`Join this session at ${displayUrl}, room code ${code}`}
    >
      {!reduce && (
        // One soft ring on arrival. No loop — a projector is not a slot machine.
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber"
          initial={{ opacity: 0.85, scale: 1 }}
          animate={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 1.6, ease: EASE_SOFT, delay: 0.25 }}
          aria-hidden="true"
        />
      )}

      <p className="stage-eyebrow text-[0.6rem] text-amber-deep">Join Team Pulse</p>

      {/* Rendered oversampled and downscaled, so it stays crisp when projected. */}
      <QrCode
        value={joinUrl}
        size={1024}
        margin={2}
        className="mt-[0.6vh] w-full rounded-lg"
      />

      <p className="mt-[0.7vh] w-full truncate text-center text-[clamp(0.5rem,0.62vw,0.72rem)] font-medium text-ink-3">
        {displayUrl}
      </p>
      <p className="mt-[0.2vh] text-[clamp(0.6rem,0.8vw,0.95rem)] font-bold text-ink">
        Code <span className="tnum">{code}</span>
      </p>
    </motion.aside>
  );
}
