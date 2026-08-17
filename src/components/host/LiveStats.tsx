"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { CountUp } from "@/lib/motion/primitives";
import type { LiveCounts } from "@/lib/types";

/**
 * The numbers the facilitator glances at between sentences: how many are here,
 * where they are, and whether it is time to move on.
 */
export function LiveStats({
  counts,
  awaitingResponses,
  simulatedCount,
}: {
  counts: LiveCounts;
  awaitingResponses: boolean;
  simulatedCount: number;
}) {
  const pct = counts.total > 0 ? (counts.responses / counts.total) * 100 : 0;
  const complete = counts.total > 0 && counts.responses >= counts.total;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="tnum text-5xl leading-none font-black text-ink">
            <CountUp value={counts.total} />
          </p>
          <p className="eyebrow mt-1.5 text-ink-3">joined</p>
        </div>

        {simulatedCount > 0 && (
          <span className="rounded-full bg-amber-wash px-2.5 py-1 text-[0.68rem] font-bold text-amber-deep">
            {simulatedCount} simulated
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="🏢 Room" value={counts.room} tone="cobalt" />
        <Stat label="💻 Online" value={counts.online} tone="amber" />
      </div>

      {awaitingResponses && (
        <div className="mt-5 border-t border-ink/8 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow text-ink-3">Responses</p>
            <p
              className={cn("tnum text-xl font-black", complete ? "text-positive-deep" : "text-ink")}
              aria-live="polite"
            >
              <CountUp value={counts.responses} /> / {counts.total}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
            <motion.div
              className={cn("h-full rounded-full", complete ? "bg-positive" : "bg-cobalt")}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cobalt" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5",
        tone === "cobalt" ? "bg-cobalt-wash" : "bg-amber-wash",
      )}
    >
      <p className="text-[0.72rem] font-bold text-ink-2">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-2xl leading-none font-black",
          tone === "cobalt" ? "text-cobalt-deep" : "text-amber-deep",
        )}
      >
        <CountUp value={value} />
      </p>
    </div>
  );
}
