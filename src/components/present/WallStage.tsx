"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/content/session-plan";
import { CountUp, springSoft } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { LiveCounts, Phase, WallItem } from "@/lib/types";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placed {
  item: WallItem;
  box: Box;
  fontPx: number;
  rank: number;
}

/**
 * The live response wall.
 *
 * Previously this used fixed concentric rings, which meant the layout only held
 * together for the exact number and length of statements it was tuned for — a
 * long sentence or an extra voice and cards started overlapping each other.
 *
 * This version places cards by actual measured geometry instead: strongest
 * statement first at the centre, then each next one at the closest position to
 * the centre that does not collide with anything already placed. Overlap
 * becomes impossible by construction rather than by tuning, at any count and
 * any sentence length.
 */
export function WallStage({
  question,
  items,
  phase,
  counts,
}: {
  question: Question;
  items: WallItem[];
  phase: Phase;
  counts: LiveCounts;
}) {
  const reduce = useReducedMotion();
  const { play } = useSound();
  const fieldRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2
          ? prev
          : { w: width, h: height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A soft chime when the room's hearts move — not on every single one.
  const totalHearts = items.reduce((sum, i) => sum + i.hearts, 0);
  const previousHearts = useRef(totalHearts);
  useEffect(() => {
    if (totalHearts > previousHearts.current) play("heart", 400);
    previousHearts.current = totalHearts;
  }, [totalHearts, play]);

  const { placed, dropped } = useMemo(() => layout(items, size), [items, size]);

  return (
    <div className="flex h-full flex-col gap-[1.4vh]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <div>
          <p className="stage-eyebrow text-amber-deep">{question.kicker}</p>
          <h1 className="display-tight mt-[0.5vh] text-[clamp(1.6rem,3.8vw,4.4rem)] text-ink">
            {question.prompt}
          </h1>
        </div>
        <p className="tnum text-[clamp(0.85rem,1.3vw,1.5rem)] font-semibold text-ink-3">
          <CountUp value={items.length} /> {items.length === 1 ? "voice" : "voices"} ·{" "}
          <CountUp value={totalHearts} /> ❤
          {phase === "voting" && (
            <>
              {" "}
              · <CountUp value={counts.responses} />/{counts.total} written
            </>
          )}
        </p>
      </div>

      <div ref={fieldRef} className="relative min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="serif-accent text-[clamp(1.2rem,2.6vw,2.8rem)] text-ink-3">
              Waiting for the first voice…
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {placed.map(({ item, box, fontPx, rank }) => {
              const hero = rank === 0;
              return (
                <motion.figure
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={springSoft}
                  className="absolute"
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    // The standalone `translate` property, not `transform`:
                    // Framer owns `transform` here for the scale animation.
                    translate: "-50% -50%",
                  }}
                >
                  <motion.div
                    animate={reduce ? {} : { y: [0, rank % 2 === 0 ? -5 : 5, 0] }}
                    transition={{
                      duration: 7 + (rank % 5),
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: rank * 0.25,
                    }}
                    className={
                      hero
                        ? "flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 shadow-raise ring-2 ring-amber/45 ring-inset"
                        : "flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lift ring-1 ring-ink/10 ring-inset"
                    }
                  >
                    <blockquote
                      className="leading-tight font-bold text-balance text-ink"
                      style={{ fontSize: fontPx }}
                    >
                      {item.text}
                    </blockquote>

                    <span className="flex shrink-0 flex-col items-end">
                      {item.hearts > 0 && (
                        <span
                          className="tnum flex items-center gap-1 font-black text-amber-deep"
                          style={{ fontSize: Math.max(11, fontPx * 0.78) }}
                        >
                          <span aria-hidden="true">❤</span>
                          {item.hearts}
                        </span>
                      )}
                      {item.voices > 1 && (
                        <span
                          className="tnum font-bold text-ink-3"
                          style={{ fontSize: Math.max(9, fontPx * 0.52) }}
                          title={`${item.voices} people wrote this`}
                        >
                          ×{item.voices}
                        </span>
                      )}
                    </span>
                  </motion.div>
                </motion.figure>
              );
            })}
          </AnimatePresence>
        )}

        {dropped > 0 && (
          <p className="absolute right-0 bottom-0 text-[clamp(0.7rem,1vw,1.1rem)] font-semibold text-ink-3">
            +{dropped} more
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const GAP = 10; // px of clear space required between any two cards

/**
 * Greedy centre-out placement.
 *
 * Items arrive already sorted by support, so index 0 is the statement the room
 * most agrees with. Each is placed at the first candidate position — scanned
 * outward from the centre — where its box clears every box already placed. That
 * gives the two things this round needs at once: prominence follows hearts
 * (earlier items get the central positions), and nothing ever overlaps.
 */
function layout(items: WallItem[], size: { w: number; h: number }): {
  placed: Placed[];
  dropped: number;
} {
  if (size.w < 10 || size.h < 10) return { placed: [], dropped: 0 };

  const placed: Placed[] = [];
  const boxes: Box[] = [];
  let dropped = 0;

  for (const [rank, item] of items.entries()) {
    const { w, h, fontPx } = measure(item, rank, size);
    const spot = findSpot(w, h, boxes, size);
    if (!spot) {
      dropped += 1;
      continue;
    }
    const box = { x: spot.x, y: spot.y, w, h };
    boxes.push(box);
    placed.push({ item, box, fontPx, rank });
  }

  return { placed, dropped };
}

/**
 * Estimates a card's rendered size.
 *
 * Text is measured by character count rather than by rendering and reading it
 * back: a measure pass would mean laying out, measuring, then re-positioning on
 * every frame the wall changes, which on a projector shows as a visible jump.
 * The estimate is deliberately generous — a card slightly wider than reality
 * only costs whitespace, whereas one slightly narrower costs an overlap.
 */
function measure(item: WallItem, rank: number, size: { w: number; h: number }) {
  // Prominence tiers. The hero is capped too — a runaway favourite must never
  // grow big enough to crowd anyone else's sentence off the wall.
  const scale = rank === 0 ? 1 : rank < 3 ? 0.82 : rank < 8 ? 0.72 : 0.62;
  // Floor of 16px: below that a statement stops being readable from the back
  // of a room, at which point showing it is worse than counting it as overflow.
  const fontPx = Math.max(16, Math.min(size.w * 0.023, 42) * scale);

  const padX = rank === 0 ? 40 : 32;
  const padY = rank === 0 ? 32 : 24;
  const badge = item.hearts > 0 ? fontPx * 2.6 : 0;

  // Inter Tight averages a little under half an em across mixed-case text.
  const textWidth = item.text.length * fontPx * 0.49;
  const maxW = Math.min(size.w * (rank === 0 ? 0.42 : 0.3), 520);

  const contentW = Math.min(textWidth, maxW - padX - badge);
  const lines = Math.max(1, Math.ceil(textWidth / Math.max(1, contentW)));

  return {
    w: Math.min(maxW, contentW + padX + badge),
    h: lines * fontPx * 1.22 + padY,
    fontPx,
  };
}

const overlaps = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w + GAP * 2 &&
  Math.abs(a.y - b.y) * 2 < a.h + b.h + GAP * 2;

/** Scans outward from the centre on an elliptical spiral for the first free spot. */
function findSpot(
  w: number,
  h: number,
  boxes: Box[],
  size: { w: number; h: number },
): { x: number; y: number } | null {
  const cx = size.w / 2;
  const cy = size.h / 2;

  const fits = (x: number, y: number) => {
    if (x - w / 2 < 0 || x + w / 2 > size.w) return false;
    if (y - h / 2 < 0 || y + h / 2 > size.h) return false;
    const candidate = { x, y, w, h };
    return !boxes.some((b) => overlaps(candidate, b));
  };

  if (fits(cx, cy)) return { x: cx, y: cy };

  const maxR = Math.hypot(size.w, size.h) / 2;
  for (let r = 24; r <= maxR; r += 14) {
    // More angles further out, so wide rings do not leave gaps unexplored.
    const steps = Math.max(12, Math.round((2 * Math.PI * r) / 40));
    // Alternate the starting angle per ring to avoid a visible radial seam.
    const phase = (r / 14) * 0.6;
    for (let i = 0; i < steps; i += 1) {
      const theta = phase + (i / steps) * Math.PI * 2;
      // Squash vertically: the stage is much wider than it is tall.
      const x = cx + Math.cos(theta) * r * 1.35;
      const y = cy + Math.sin(theta) * r * 0.78;
      if (fits(x, y)) return { x, y };
    }
  }
  return null;
}
