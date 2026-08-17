"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { JoinModeScreen } from "./JoinModeScreen";
import { ParticipantShell } from "./ParticipantShell";
import { QuestionStage } from "./QuestionStage";
import { StatusScreen } from "./StatusScreen";
import { WallList } from "./WallList";
import { getQuestion, getRound } from "@/lib/content/session-plan";
import { useParticipant } from "@/lib/client/useSession";
import { SoundProvider } from "@/lib/sound/SoundProvider";
import { stageSwap } from "@/lib/motion/primitives";

export function ParticipantApp({ code }: { code: string }) {
  const participant = useParticipant(code);

  return (
    // The facilitator's mute switch travels down the session stream, so
    // silencing the room silences every phone in it too.
    <SoundProvider enabled={participant.state?.settings.soundEnabled ?? true}>
      <ParticipantAppInner code={code} participant={participant} />
    </SoundProvider>
  );
}

function ParticipantAppInner({
  code,
  participant,
}: {
  code: string;
  participant: ReturnType<typeof useParticipant>;
}) {
  const { state, identity, ready, connection, join, joining, submit, react, error } = participant;

  const question = useMemo(
    () => (state?.step?.type === "question" ? getQuestion(state.step.questionId) : null),
    [state],
  );
  const round = question ? getRound(question.roundId) : null;

  // First paint before local identity is read — a blank frame is better than
  // flashing the join screen at someone who is already in.
  if (!ready && !state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper">
        <span className="sr-only">Loading session</span>
        <span className="h-2 w-2 animate-ping rounded-full bg-cobalt" />
      </main>
    );
  }

  if (!identity) {
    return (
      <JoinModeScreen
        code={code}
        onJoin={join}
        joining={joining}
        error={error}
        connection={connection}
        counts={state?.counts}
        ended={state?.status === "ended"}
      />
    );
  }

  const key = state ? `${state.status}:${state.stepIndex}:${state.phase}` : "boot";

  return (
    <ParticipantShell
      connection={connection}
      mode={identity.mode}
      roundLabel={round ? `Round ${round.index} · ${round.title}` : "Team Pulse"}
      stepIndex={state?.stepIndex ?? 0}
      stepCount={state?.stepCount ?? 1}
      live={state?.status === "live"}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          variants={stageSwap}
          initial="hidden"
          animate="show"
          exit="exit"
          className="flex flex-1 flex-col"
        >
          {renderStage()}
        </motion.div>
      </AnimatePresence>
    </ParticipantShell>
  );

  function renderStage() {
    if (!state) return <StatusScreen kind="connecting" />;
    if (state.status === "lobby") return <StatusScreen kind="lobby" counts={state.counts} />;
    if (state.status === "ended") return <StatusScreen kind="ended" />;
    if (state.status === "paused") return <StatusScreen kind="paused" />;

    if (state.step?.type === "closing") {
      return <StatusScreen kind="closing" />;
    }

    if (!question) return <StatusScreen kind="waiting" />;

    // The wall is the one place a participant keeps looking at their phone
    // after answering — hearts are the interaction.
    const showWall = question.kind === "open-text" && state.wall.length > 0;

    return (
      <div className="flex flex-1 flex-col gap-6">
        <QuestionStage
          question={question}
          state={state}
          onSubmit={(payload) => submit(question.id, payload)}
          error={error}
        />
        {showWall && state.settings.allowHearts && (
          <WallList items={state.wall} onReact={react} />
        )}
      </div>
    );
  }
}
