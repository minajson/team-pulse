"use client";

import { motion } from "framer-motion";
import { QrCode } from "@/components/ui/QrCode";
import { useOrigin } from "@/lib/client/browser-state";
import { Tagline } from "@/components/ui/Wordmark";
import { PulseField } from "@/components/visual/PulseField";
import { CountUp, slideUp, stagger } from "@/lib/motion/primitives";
import type { LiveCounts } from "@/lib/types";

/**
 * The screen the room walks in to. It has one job: make scanning feel like the
 * obvious thing to do in the next five seconds.
 */
export function JoinStage({
  code,
  counts,
  showQr,
}: {
  code: string;
  counts: LiveCounts;
  showQr: boolean;
}) {
  const origin = useOrigin();

  const joinUrl = origin ? `${origin}/j/${code}` : `/j/${code}`;
  const displayUrl = origin ? `${origin.replace(/^https?:\/\//, "")}/j/${code}` : "";

  return (
    <div className="relative flex h-full w-full items-center">
      <PulseField className="opacity-60" density={40} linkDistance={230} />

      <motion.div
        variants={stagger(0.12, 0.1)}
        initial="hidden"
        animate="show"
        // Switches to two columns well below the projector's width so the
        // facilitator's inline preview shows the same composition the room does.
        className="relative grid w-full items-center gap-[3vw] md:grid-cols-[1.15fr_0.85fr]"
      >
        <div>
          <motion.p variants={slideUp} className="stage-eyebrow text-amber-deep">
            Live now
          </motion.p>

          <motion.h1
            variants={slideUp}
            className="display-tight mt-[1.6vh] text-[clamp(3rem,8.5vw,10rem)] text-ink"
          >
            Team Pulse
          </motion.h1>

          <motion.div variants={slideUp}>
            <Tagline className="mt-[1.6vh] block text-[clamp(1.2rem,2.4vw,2.8rem)]" />
          </motion.div>

          <motion.div variants={slideUp} className="mt-[5vh] flex flex-wrap items-end gap-[3vw]">
            <div>
              <p className="stage-eyebrow text-ink-3">Room code</p>
              <p className="tnum mt-1 text-[clamp(3rem,7vw,8rem)] leading-none font-black text-amber-deep">
                {code}
              </p>
            </div>

            <div className="pb-[0.6vh]">
              <p className="stage-eyebrow text-ink-3">Connected</p>
              <p className="tnum mt-1 text-[clamp(2.4rem,5.5vw,6.5rem)] leading-none font-black text-ink">
                <CountUp value={counts.total} />
              </p>
              <p className="mt-1 text-[clamp(0.85rem,1.15vw,1.3rem)] font-semibold text-ink-3">
                🏢 {counts.room} in the room · 💻 {counts.online} online
              </p>
            </div>
          </motion.div>
        </div>

        {showQr && (
          <motion.div variants={slideUp} className="flex flex-col items-center">
            <div className="relative rounded-[2.5vw] bg-surface p-[1.4vw] shadow-raise ring-1 ring-ink/10 ring-inset">
              <QrCode value={joinUrl} className="w-[min(26vw,34vh)] rounded-[1vw]" />
            </div>
            <p className="mt-[2.2vh] text-[clamp(1.1rem,2vw,2.2rem)] font-bold text-ink">
              Scan to join
            </p>
            {displayUrl && (
              <p className="mt-1 text-[clamp(0.8rem,1.1vw,1.25rem)] font-medium text-ink-3">
                or {displayUrl}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
