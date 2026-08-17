"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Question } from "@/lib/content/session-plan";
import { slideUp, springSnappy, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";

/**
 * Four people, one hard choice. The cards carry enough detail to make the
 * decision feel real, and the selected card lifts rather than shouts — nobody
 * should feel they are being congratulated for leaving someone behind.
 */
export function ProfilePickInput({
  question,
  selected,
  disabled,
  onSelect,
}: {
  question: Question;
  selected: string[];
  disabled: boolean;
  onSelect: (profileId: string) => void;
}) {
  const { play } = useSound();
  const profiles = question.profiles ?? [];

  return (
    <motion.ul
      variants={stagger(0.05, 0.07)}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-labelledby={`question-${question.id}`}
    >
      {profiles.map((profile) => {
        const active = selected.includes(profile.id);
        const accent = `hsl(${profile.hue} 72% 46%)`;
        const wash = `hsl(${profile.hue} 78% 97%)`;

        return (
          <motion.li key={profile.id} variants={slideUp}>
            <motion.button
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                play("profileSelect");
                onSelect(profile.id);
              }}
              animate={active ? { y: -4 } : { y: 0 }}
              transition={springSnappy}
              style={
                active
                  ? { background: wash, boxShadow: `0 18px 40px -20px ${accent}` }
                  : undefined
              }
              className={cn(
                "relative flex h-full w-full flex-col overflow-hidden rounded-3xl px-5 py-5 text-left transition-shadow duration-300",
                "shadow-lift ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-70",
                active ? "ring-2" : "bg-surface ring-ink/10 hover:ring-ink/25",
              )}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: accent }}
                aria-hidden="true"
              />

              <span className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-black tracking-tight text-ink">{profile.name}</span>
                {active && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.65rem] font-black tracking-wider text-white uppercase"
                    style={{ background: accent }}
                  >
                    Chosen
                  </span>
                )}
              </span>

              <span
                className="eyebrow mt-1 block"
                style={{ color: accent }}
              >
                {profile.title}
              </span>

              <ul className="mt-3 flex flex-col gap-1.5">
                {profile.traits.map((trait) => (
                  <li key={trait} className="flex gap-2 text-sm leading-snug text-ink-2">
                    <span
                      className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full"
                      style={{ background: accent }}
                      aria-hidden="true"
                    />
                    {trait}
                  </li>
                ))}
              </ul>
            </motion.button>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
