"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { OpenTextInput } from "./inputs/OpenTextInput";
import { PickTwoInput } from "./inputs/PickTwoInput";
import { PointsInput } from "./inputs/PointsInput";
import { ProfilePickInput } from "./inputs/ProfilePickInput";
import { SingleChoiceInput } from "./inputs/SingleChoiceInput";
import type { SubmitPayload } from "@/lib/client/useSession";
import type { Question } from "@/lib/content/session-plan";
import { slideUp } from "@/lib/motion/primitives";
import { useSound } from "@/lib/sound/SoundProvider";
import type { PublicSessionState } from "@/lib/types";

/**
 * Chooses the right interaction for the question and handles the two states
 * every round shares: answering, and the moment after the facilitator reveals
 * — when the right thing for a participant to do is look up.
 */
export function QuestionStage({
  question,
  state,
  onSubmit,
  error,
}: {
  question: Question;
  state: PublicSessionState;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  error: string | null;
}) {
  const { play } = useSound();
  const revealed = state.phase === "revealed" || state.phase === "discuss";
  const locked = state.phase === "locked" || revealed;
  const you = state.you;

  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    play("reveal");
  }, [revealed, play]);

  const submit = async (payload: SubmitPayload) => {
    await onSubmit(payload);
    play("submit");
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1100);
  };

  if (revealed) {
    return <LookUp question={question} you={you} />;
  }

  if (locked && !you?.answered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
        <p className="text-5xl" aria-hidden="true">
          ⏳
        </p>
        <h2 className="display-tight mt-6 text-3xl">Answers are closed</h2>
        <p className="mt-3 max-w-xs text-ink-2">
          This one got away — the results are on the big screen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <motion.div variants={slideUp} initial="hidden" animate="show">
        {question.kicker && (
          <p className="eyebrow mb-3 text-cobalt">{question.kicker}</p>
        )}
        <h1
          className="display-loose text-[clamp(1.6rem,6.5vw,2.1rem)] text-balance"
          id={`question-${question.id}`}
        >
          {question.participantPrompt ?? question.prompt}
        </h1>
      </motion.div>

      <div className="mt-7 flex-1">
        {question.kind === "single" || question.kind === "split" ? (
          <SingleChoiceInput
            question={question}
            selected={you?.optionIds ?? []}
            disabled={locked}
            onSelect={(optionId) => submit({ optionIds: [optionId] })}
          />
        ) : question.kind === "profile" ? (
          <ProfilePickInput
            question={question}
            selected={you?.optionIds ?? []}
            disabled={locked}
            onSubmit={(optionIds) => submit({ optionIds })}
          />
        ) : question.kind === "pick-two" ? (
          <PickTwoInput
            question={question}
            selected={you?.optionIds ?? []}
            disabled={locked}
            onSubmit={(optionIds) => submit({ optionIds })}
          />
        ) : question.kind === "points" ? (
          <PointsInput
            question={question}
            initial={you?.points ?? null}
            disabled={locked}
            onSubmit={(points) => submit({ points })}
          />
        ) : (
          <OpenTextInput
            question={question}
            initial={you?.text ?? ""}
            moderation={you?.moderation ?? null}
            disabled={locked}
            onSubmit={(text) => submit({ text })}
          />
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="sticky bottom-4 mt-4 rounded-xl bg-alert-wash px-4 py-3 text-sm font-semibold text-alert-deep ring-1 ring-alert/25 ring-inset"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flash && !error && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none sticky bottom-4 z-10 mt-4 flex items-center justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-positive px-4 py-2 text-sm font-bold text-white shadow-raise">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Answer saved
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** After a reveal, the phone gets out of the way. */
function LookUp({
  question,
  you,
}: {
  question: Question;
  you: PublicSessionState["you"];
}) {
  const yourAnswer = describeAnswer(question, you);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <motion.p
        className="text-6xl"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        👀
      </motion.p>
      <h2 className="display-tight mt-6 text-[clamp(2rem,9vw,2.6rem)]">Look up</h2>
      <p className="mt-3 max-w-xs text-ink-2">The results are on the big screen.</p>

      {yourAnswer && (
        <div className="mt-10 w-full max-w-sm rounded-2xl bg-surface p-5 text-left shadow-lift ring-1 ring-ink/10 ring-inset">
          <p className="eyebrow text-ink-3">You chose</p>
          <p className="mt-2 font-semibold text-balance text-ink">{yourAnswer}</p>
        </div>
      )}
    </div>
  );
}

function describeAnswer(question: Question, you: PublicSessionState["you"]): string | null {
  if (!you?.answered) return null;
  if (you.text) return `“${you.text}”`;
  if (you.points) {
    const top = Object.entries(you.points)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => `${question.values?.find((v) => v.id === id)?.label ?? id} ${n}`)
      .join(" · ");
    return top || null;
  }
  if (you.optionIds.length > 0) {
    // Profiles are listed by name alone once there are several of them —
    // "Nory — The Expert · Dove — The Team Player · …" is unreadable on a phone.
    const many = you.optionIds.length > 1;
    return you.optionIds
      .map((id) => {
        const option = question.options?.find((o) => o.id === id);
        if (option) return `${option.emoji ? `${option.emoji} ` : ""}${option.label}`;
        const profile = question.profiles?.find((p) => p.id === id);
        if (profile) return many ? profile.name : `${profile.name} — ${profile.title}`;
        return id;
      })
      .join(" · ");
  }
  return null;
}
