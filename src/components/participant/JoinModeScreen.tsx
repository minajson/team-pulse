"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Tagline, Wordmark } from "@/components/ui/Wordmark";
import { PulseField } from "@/components/visual/PulseField";
import type { ConnectionState } from "@/lib/client/stream";
import { slideUp, stagger } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { JoinMode, LiveCounts } from "@/lib/types";

/**
 * Two taps from a scanned code to being in the room. The only question asked
 * is the one the session actually needs answered — where you are sitting.
 */
export function JoinModeScreen({
  code,
  onJoin,
  joining,
  error,
  connection,
  counts,
  ended,
}: {
  code: string;
  onJoin: (mode: JoinMode) => Promise<void>;
  joining: boolean;
  error: string | null;
  connection: ConnectionState;
  counts?: LiveCounts;
  ended?: boolean;
}) {
  const [pending, setPending] = useState<JoinMode | null>(null);
  const { play } = useSound();

  const choose = async (mode: JoinMode) => {
    if (joining) return;
    setPending(mode);
    play("select");
    try {
      await onJoin(mode);
      play("join");
    } catch {
      setPending(null);
    }
  };

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-paper">
      <PulseField className="opacity-55" density={20} />

      <div className="safe-bottom relative mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-8">
        <div className="flex items-center justify-between">
          <Wordmark size="sm" />
          <ConnectionBadge connection={connection} />
        </div>

        <motion.div
          variants={stagger(0.1, 0.09)}
          initial="hidden"
          animate="show"
          className="flex flex-1 flex-col justify-center py-10"
        >
          <motion.p variants={slideUp} className="eyebrow text-cobalt">
            Room {code}
          </motion.p>

          <motion.h1
            variants={slideUp}
            className="display-tight mt-4 text-[clamp(2.6rem,13vw,4rem)]"
          >
            Where are you
            <br />
            joining from?
          </motion.h1>

          <motion.div variants={slideUp}>
            <Tagline className="mt-4 block text-lg" />
          </motion.div>

          {ended ? (
            <motion.p
              variants={slideUp}
              className="mt-10 rounded-2xl bg-surface p-5 text-ink-2 shadow-lift ring-1 ring-ink/10 ring-inset"
            >
              This session has already finished. Ask your facilitator for a new room code.
            </motion.p>
          ) : (
            <motion.div variants={slideUp} className="mt-10 flex flex-col gap-3">
              <ModeButton
                emoji="🏢"
                label="In the room"
                hint="You're here in person"
                onClick={() => choose("room")}
                busy={pending === "room" && joining}
                disabled={joining}
                accent="cobalt"
              />
              <ModeButton
                emoji="💻"
                label="Online"
                hint="You're joining remotely"
                onClick={() => choose("online")}
                busy={pending === "online" && joining}
                disabled={joining}
                accent="amber"
              />
            </motion.div>
          )}

          {error && (
            <motion.p variants={slideUp} role="alert" className="mt-4 text-sm font-semibold text-alert-deep">
              {error}
            </motion.p>
          )}

          {counts && counts.total > 0 && (
            <motion.p variants={slideUp} className="mt-8 text-sm text-ink-3">
              <span className="tnum font-bold text-ink">{counts.total}</span> already joined —{" "}
              <span className="tnum">{counts.room}</span> in the room,{" "}
              <span className="tnum">{counts.online}</span> online.
            </motion.p>
          )}
        </motion.div>

        <p className="pb-6 text-center text-xs text-ink-3">
          No account, no email. Your answers are anonymous.
        </p>
      </div>
    </main>
  );
}

function ModeButton({
  emoji,
  label,
  hint,
  onClick,
  busy,
  disabled,
  accent,
}: {
  emoji: string;
  label: string;
  hint: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  accent: "cobalt" | "amber";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative flex min-h-[5.5rem] w-full items-center gap-4 overflow-hidden rounded-3xl bg-surface px-6 py-5 text-left",
        "shadow-lift ring-1 ring-ink/10 ring-inset transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-raise active:translate-y-0 active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        accent === "cobalt" ? "hover:ring-cobalt/40" : "hover:ring-amber/50",
      ].join(" ")}
    >
      <span
        className={[
          "absolute inset-y-0 left-0 w-1.5 transition-all duration-300 group-hover:w-2.5",
          accent === "cobalt" ? "bg-cobalt" : "bg-amber",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="flex-1">
        <span className="block text-xl font-bold tracking-tight text-ink">{label}</span>
        <span className="block text-sm text-ink-3">{busy ? "Joining…" : hint}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 shrink-0 text-ink-4 transition-transform duration-300 group-hover:translate-x-1"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
