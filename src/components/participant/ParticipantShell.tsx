"use client";

import type { ReactNode } from "react";
import type { ConnectionState } from "@/lib/client/stream";
import { cn } from "@/lib/cn";
import type { JoinMode } from "@/lib/types";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { PulseDot } from "@/components/ui/Wordmark";

/**
 * The frame every participant screen sits in: a quiet header that says where
 * we are, and a content column sized for one thumb.
 */
export function ParticipantShell({
  children,
  connection,
  mode,
  roundLabel,
  stepIndex,
  stepCount,
  live,
}: {
  children: ReactNode;
  connection: ConnectionState;
  mode: JoinMode;
  roundLabel: string;
  stepIndex: number;
  stepCount: number;
  live: boolean;
}) {
  const progress = stepCount > 0 ? ((stepIndex + 1) / stepCount) * 100 : 0;

  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-xl px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {live && <PulseDot size={7} />}
              <span className="truncate text-[0.8rem] font-semibold text-ink-2">{roundLabel}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <ConnectionBadge connection={connection} />
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[0.7rem] font-bold tracking-wide uppercase",
                  mode === "room"
                    ? "bg-cobalt-wash text-cobalt-deep"
                    : "bg-amber-wash text-amber-deep",
                )}
              >
                {mode === "room" ? "🏢 Room" : "💻 Online"}
              </span>
            </span>
          </div>

          <div
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/8"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={stepCount}
            aria-valuenow={stepIndex + 1}
            aria-label="Session progress"
          >
            <div
              className="h-full rounded-full bg-cobalt transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <div className="safe-bottom mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-6">
        {children}
      </div>
    </main>
  );
}
