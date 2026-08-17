"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChoiceStage } from "./ChoiceStage";
import { ClosingStage } from "./ClosingStage";
import { DnaStage } from "./DnaStage";
import { JoinPanel } from "./JoinPanel";
import { JoinStage } from "./JoinStage";
import { MoneyStage } from "./MoneyStage";
import { ProfileStage } from "./ProfileStage";
import { SplitStage } from "./SplitStage";
import { StageFrame } from "./StageFrame";
import { WallStage } from "./WallStage";
import { useSessionStream } from "@/lib/client/useSession";
import { getQuestion, getRound } from "@/lib/content/session-plan";
import { cn } from "@/lib/cn";
import { stageSwap } from "@/lib/motion/primitives";
import { SoundProvider, useSound } from "@/lib/sound/SoundProvider";

/**
 * The projector. Read-only by design: it renders whatever the session stream
 * says and offers no way to change it, so a nudged trackpad in a dark room
 * cannot skip the round everyone is mid-way through answering.
 */
export function PresentationApp({ code, preview }: { code: string; preview: boolean }) {
  const { state, connection } = useSessionStream(code);

  return (
    <SoundProvider enabled={!preview && (state?.settings.soundEnabled ?? true)}>
      <PresentationInner code={code} preview={preview} state={state} connection={connection} />
    </SoundProvider>
  );
}

function PresentationInner({
  code,
  preview,
  state,
  connection,
}: {
  code: string;
  preview: boolean;
  state: ReturnType<typeof useSessionStream>["state"];
  connection: ReturnType<typeof useSessionStream>["connection"];
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const { play } = useSound();

  const question = useMemo(
    () => (state?.step?.type === "question" ? getQuestion(state.step.questionId) : null),
    [state],
  );
  const round = question ? getRound(question.roundId) : null;

  // A soft transition cue whenever the room moves to a new screen.
  const lastStep = useRef<number | null>(null);
  useEffect(() => {
    if (!state) return;
    if (lastStep.current !== null && lastStep.current !== state.stepIndex) play("advance");
    lastStep.current = state.stepIndex;
  }, [state, play]);

  useEffect(() => {
    if (state?.status === "ended") play("sessionClose");
  }, [state?.status, play]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Denied by the browser (or unsupported) — the page still works windowed.
    }
  }, []);

  useEffect(() => {
    if (preview) return;
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [preview, toggleFullscreen]);

  // Hide the cursor and the fullscreen button when nobody is touching the
  // laptop — the projector should show content, not UI.
  useEffect(() => {
    if (preview) return;
    const show = () => {
      setChromeVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setChromeVisible(false), 2800);
    };
    show();
    window.addEventListener("pointermove", show);
    return () => {
      window.removeEventListener("pointermove", show);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [preview]);

  const counts = state?.counts ?? { total: 0, room: 0, online: 0, responses: 0 };
  const joinOverlay = state?.overlay === "join";

  /*
   * The compact join panel rides alongside any question that is still taking
   * answers, and only that. Once the facilitator reveals, the result owns the
   * screen — so locked, revealed, discuss, the closing screens and the final
   * screen all show nothing, and the stage takes the space back.
   */
  const showJoinPanel =
    Boolean(question) &&
    state?.status === "live" &&
    state?.phase === "voting" &&
    !joinOverlay;
  const inLobby = !state || state.status === "lobby" || joinOverlay;
  const stageKey = state
    ? joinOverlay
      ? "join-overlay"
      : state.status === "lobby"
        ? "lobby"
        : `${state.stepIndex}`
    : "boot";

  return (
    <main
      className={cn(
        "relative h-dvh w-full overflow-hidden bg-paper",
        preview && "h-full",
        !chromeVisible && !preview && "cursor-none",
      )}
    >
      <StageFrame
        code={code}
        counts={counts}
        connection={connection}
        roundLabel={inLobby ? undefined : (round?.title ?? "Closing")}
        roundIndex={inLobby ? undefined : round?.index}
        showResponses={Boolean(question) && state?.status !== "lobby"}
        aside={
          showJoinPanel && question ? (
            // Keyed on the question so each newly opened one replays the
            // single arrival pulse.
            <JoinPanel key={question.id} code={code} />
          ) : null
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stageKey}
            variants={stageSwap}
            initial="hidden"
            animate="show"
            exit="exit"
            className="h-full w-full"
          >
            {renderStage()}
          </motion.div>
        </AnimatePresence>
      </StageFrame>

      {!preview && (
        <button
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className={cn(
            "absolute top-4 right-4 z-30 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink-2",
            "shadow-lift ring-1 ring-ink/12 ring-inset transition-opacity duration-500 hover:text-ink",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {fullscreen ? "Exit fullscreen" : "Fullscreen (F)"}
        </button>
      )}
    </main>
  );

  function renderStage() {
    /*
     * The overlay is checked before the step, so showing the QR mid-round is
     * purely a projector concern: stepIndex, phase and every response stay
     * exactly as they were, and returning puts the room back where it was.
     */
    if (!state || joinOverlay || state.status === "lobby") {
      return (
        <JoinStage
          code={code}
          counts={counts}
          // A facilitator who has explicitly asked for the QR gets it, even if
          // they had hidden it from the lobby earlier.
          showQr={joinOverlay || (state?.settings.showQr ?? true)}
        />
      );
    }

    if (state.step?.type === "closing") {
      return <ClosingStage screen={state.step.screen} summary={state.summary} />;
    }

    if (!question) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="serif-accent text-[clamp(1.2rem,2.6vw,2.8rem)] text-ink-3">
            Standing by…
          </p>
        </div>
      );
    }

    switch (question.kind) {
      case "split":
        return (
          <SplitStage
            question={question}
            results={state.results}
            phase={state.phase}
            counts={counts}
            commentary={state.settings.splitCommentary}
          />
        );
      case "profile":
        return (
          <ProfileStage
            question={question}
            results={state.results}
            phase={state.phase}
            counts={counts}
          />
        );
      case "pick-two":
        return (
          <MoneyStage
            question={question}
            results={state.results}
            phase={state.phase}
            counts={counts}
          />
        );
      case "points":
        return (
          <DnaStage question={question} results={state.results} phase={state.phase} counts={counts} />
        );
      case "open-text":
        return (
          <WallStage question={question} items={state.wall} phase={state.phase} counts={counts} />
        );
      default:
        return (
          <ChoiceStage
            question={question}
            results={state.results}
            phase={state.phase}
            counts={counts}
          />
        );
    }
  }
}
