"use client";

import { animate, motion, useReducedMotion, type Transition, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The motion vocabulary for Team Pulse.
 *
 * Two rules run through all of it: movement carries meaning (a bar growing is
 * data arriving, a card lifting is a choice being made), and the screen must
 * stay readable while it moves. Springs are used where something should feel
 * physical — money landing, a card being picked — and eased curves everywhere
 * text is involved, because text that overshoots is text you cannot read.
 */

export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const springSoft: Transition = { type: "spring", stiffness: 240, damping: 26, mass: 0.9 };
export const springSnappy: Transition = { type: "spring", stiffness: 420, damping: 30, mass: 0.7 };
export const springDrop: Transition = { type: "spring", stiffness: 300, damping: 18, mass: 1.1 };

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

export const pulseIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE_SOFT } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.28, ease: EASE_IN_OUT } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SOFT } },
  exit: { opacity: 0, y: -14, transition: { duration: 0.26, ease: EASE_IN_OUT } },
};

export const softScale: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_SOFT } },
  exit: { opacity: 0, scale: 0.99, transition: { duration: 0.2 } },
};

/** Full-screen projector transitions: deliberate, cinematic, never bouncy. */
export const stageSwap: Variants = {
  hidden: { opacity: 0, y: 34, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE_SOFT },
  },
  exit: {
    opacity: 0,
    y: -24,
    filter: "blur(6px)",
    transition: { duration: 0.38, ease: EASE_IN_OUT },
  },
};

/** Container that staggers its children in. Pair with `slideUp` on each child. */
export const stagger = (delayChildren = 0.06, staggerChildren = 0.06): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

/** Response cards on the wall: they arrive, then keep breathing very slightly. */
export const floatIn: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 24 },
  show: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, scale: 0.86, transition: { duration: 0.3, ease: EASE_IN_OUT } },
};

/* ------------------------------------------------------------------ */
/* Count-up                                                            */
/* ------------------------------------------------------------------ */

interface CountUpProps {
  value: number;
  /** Decimal places. */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

/**
 * Animated counter. Under reduced-motion it snaps to the final value
 * immediately — the number is the information, the climb is decoration.
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 1.1,
  className,
}: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    if (reduce) {
      // Nothing to animate, and nothing to store: the rendered value is
      // derived from `value` directly below.
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: EASE_SOFT,
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        previous.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  const shown = reduce ? value : display;

  return (
    <span className={`tnum ${className ?? ""}`}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kinetic phrase                                                      */
/* ------------------------------------------------------------------ */

interface KineticPhraseProps {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  /** Seconds between words. */
  step?: number;
}

/**
 * Word-by-word reveal for the big closing statements. Splits on whitespace and
 * keeps each word an inline-block so line breaks still land naturally.
 */
export function KineticPhrase({
  text,
  className,
  wordClassName,
  delay = 0,
  step = 0.075,
}: KineticPhraseProps) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {words.map((word, i) => (
        // The separator sits outside the clip mask: a trailing space inside an
        // inline-block is collapsed away, which runs the words together.
        <span key={`${word}-${i}`}>
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span
              className={`inline-block ${wordClassName ?? ""}`}
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{ duration: 0.62, ease: EASE_SOFT, delay: delay + i * step }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Bar grow                                                            */
/* ------------------------------------------------------------------ */

interface BarGrowProps {
  /** 0–100. */
  pct: number;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Vertical bars grow from the bottom instead of the left. */
  vertical?: boolean;
}

export function BarGrow({ pct, delay = 0, className, style, vertical }: BarGrowProps) {
  const reduce = useReducedMotion();
  const target = Math.max(0, Math.min(100, pct));
  const axis = vertical ? "height" : "width";

  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? { [axis]: `${target}%` } : { [axis]: "0%" }}
      animate={{ [axis]: `${target}%` }}
      transition={
        reduce ? { duration: 0 } : { duration: 1.05, ease: EASE_SOFT, delay }
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Spotlight                                                           */
/* ------------------------------------------------------------------ */

/** Draws the eye to a single result without hiding the rest. */
export function Spotlight({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={
        reduce
          ? {}
          : {
              scale: active ? 1.015 : 1,
              opacity: active ? 1 : 0.62,
            }
      }
      transition={{ duration: 0.6, ease: EASE_SOFT }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Ambient pulse ring — the "you're in, keep this open" signal          */
/* ------------------------------------------------------------------ */

export function PulseRings({
  className,
  color = "var(--color-cobalt)",
  count = 3,
}: {
  className?: string;
  color?: string;
  count?: number;
}) {
  return (
    <span className={`pointer-events-none absolute inset-0 ${className ?? ""}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="animate-pulse-ring absolute inset-0 rounded-full border-2"
          style={{ borderColor: color, animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </span>
  );
}
