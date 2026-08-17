"use client";

import { AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Wordmark";
import type { ConnectionState } from "@/lib/client/stream";
import { cn } from "@/lib/cn";
import { CountUp } from "@/lib/motion/primitives";
import type { LiveCounts } from "@/lib/types";

/**
 * The projector chrome: a thin band of context top and bottom, and everything
 * else given over to the content.
 *
 * Nothing here is interactive — the facilitator drives from their own screen,
 * and a stray click on the projector should never change what the room is
 * looking at.
 *
 * The band is deliberately quiet: at projector scale, anything with a border or
 * a fill competes with the content, so context lives in weight and colour
 * instead of in boxes.
 */
export function StageFrame({
  children,
  roundLabel,
  roundIndex,
  code,
  counts,
  showResponses,
  connection,
  className,
  aside,
}: {
  children: ReactNode;
  roundLabel?: string;
  roundIndex?: number;
  code: string;
  counts: LiveCounts;
  showResponses?: boolean;
  connection: ConnectionState;
  className?: string;
  /**
   * Rendered as a reserved column beside the stage, not floated over it.
   *
   * An absolutely-positioned corner panel would have to be hand-tuned against
   * every stage — and rounds 3, 4 and 6 all use the full width, so it would sit
   * on top of a profile card, an investment column, or somebody's sentence.
   * Giving it a column instead makes overlap impossible at any resolution, and
   * when it goes away on reveal the stage reclaims the space by itself.
   */
  aside?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-paper text-ink",
        className,
      )}
    >
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-6 px-[3vw] pt-[2.6vh]">
        <div className="flex items-baseline gap-[1.6vw]">
          <Wordmark size="sm" showDot={false} />
          {roundLabel && (
            <span className="stage-eyebrow text-ink-3">
              {roundIndex ? `Round ${roundIndex} — ` : ""}
              {roundLabel}
            </span>
          )}
        </div>
        <ConnectionBadge connection={connection} />
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 items-stretch gap-[2vw] px-[5vw] py-[2vh]">
        <div className="flex min-w-0 flex-1 flex-col justify-center">{children}</div>
        <AnimatePresence>{aside}</AnimatePresence>
      </div>

      <footer className="relative z-10 flex shrink-0 items-center justify-between gap-6 px-[3vw] pb-[2.6vh] text-ink-3">
        <span className="flex items-center gap-[1.4vw] text-[clamp(0.75rem,1vw,1.05rem)] font-semibold">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cobalt" aria-hidden="true" />
            <span className="tnum text-ink">{counts.total}</span> joined
          </span>
          <span className="text-ink-4">·</span>
          <span className="tnum">🏢 {counts.room}</span>
          <span className="tnum">💻 {counts.online}</span>
        </span>

        {showResponses ? (
          <span
            className="text-[clamp(0.8rem,1.05vw,1.15rem)] font-bold text-ink"
            aria-live="polite"
          >
            <CountUp value={counts.responses} /> / {counts.total} answered
          </span>
        ) : (
          <span />
        )}

        <span className="flex items-center gap-3 text-[clamp(0.75rem,1vw,1.05rem)] font-semibold">
          Room code
          <span className="tnum rounded-lg bg-ink px-3 py-1 text-white">{code}</span>
        </span>
      </footer>
    </div>
  );
}
