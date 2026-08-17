"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ConnectionState } from "@/lib/client/stream";
import { cn } from "@/lib/cn";

/**
 * Only ever visible when something is wrong. A healthy connection says
 * nothing — a participant should not have to think about the transport.
 */
export function ConnectionBadge({
  connection,
  tone = "ink",
  className,
}: {
  connection: ConnectionState;
  tone?: "ink" | "chalk";
  className?: string;
}) {
  const degraded = connection === "reconnecting" || connection === "closed";
  const label = connection === "closed" ? "Session unavailable" : "Reconnecting…";

  return (
    <AnimatePresence>
      {degraded && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold",
            tone === "chalk"
              ? "bg-white/10 text-amber-lift ring-1 ring-inset ring-white/15"
              : "bg-amber-wash text-amber-deep ring-1 ring-inset ring-amber/30",
            className,
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber" />
          </span>
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
