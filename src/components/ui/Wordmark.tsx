"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * The wordmark. The dot is the product: a single beat that keeps time whether
 * anyone is looking at it or not.
 */
export function PulseDot({
  className,
  color = "var(--color-cobalt)",
  size = 10,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ scale: [1, 2.6, 2.6], opacity: [0.5, 0, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        animate={reduce ? {} : { scale: [1, 1.14, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

export function Wordmark({
  className,
  tone = "ink",
  size = "md",
  showDot = true,
}: {
  className?: string;
  tone?: "ink" | "chalk";
  size?: "sm" | "md" | "lg" | "stage";
  showDot?: boolean;
}) {
  const sizes = {
    sm: "text-[0.95rem] tracking-[0.28em]",
    md: "text-xl tracking-[0.24em] sm:text-2xl",
    lg: "text-3xl tracking-[0.2em] sm:text-5xl",
    stage: "text-[clamp(2.2rem,6vw,6.5rem)] tracking-[0.12em]",
  } as const;

  const dotSize = { sm: 6, md: 9, lg: 14, stage: 22 }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.55em] font-black uppercase",
        sizes[size],
        tone === "chalk" ? "text-chalk" : "text-ink",
        className,
      )}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {showDot && (
        <PulseDot
          size={dotSize}
          color={tone === "chalk" ? "var(--color-amber)" : "var(--color-cobalt)"}
        />
      )}
      Team Pulse
    </span>
  );
}

export function Tagline({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "chalk";
}) {
  return (
    <span
      className={cn(
        "serif-accent",
        tone === "chalk" ? "text-chalk-2" : "text-ink-2",
        className,
      )}
    >
      What does our team really think?
    </span>
  );
}
