"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExportPanel } from "./ExportPanel";
import { LiveStats } from "./LiveStats";
import { ModerationPanel } from "./ModerationPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StepNavigator } from "./StepNavigator";
import { TransportBar } from "./TransportBar";
import { Button } from "@/components/ui/Button";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Wordmark";
import { useHydrated, useStoredValue, writeStored } from "@/lib/client/browser-state";
import { facilitatorKey, useFacilitator } from "@/lib/client/useSession";
import { getQuestion, getRound, stepLabel } from "@/lib/content/session-plan";
import type { ControlCommand } from "@/lib/types";

/**
 * The facilitator's screen. Everything they need while standing in front of a
 * room, and nothing that would ever be projected.
 */
export function FacilitatorApp({ code }: { code: string }) {
  // Read straight from storage: the token is written once at session creation
  // and never changes, so mirroring it into state only adds a render pass.
  const hydrated = useHydrated();
  const token = useStoredValue(facilitatorKey(code));

  const { state, connection, error, busy, send } = useFacilitator(code, token);

  const dispatch = useCallback((command: ControlCommand) => void send(command), [send]);

  // Keyboard transport. Ignored while typing, so the moderation filters and
  // the threshold slider still work normally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "next" });
          break;
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "back" });
          break;
        case "r":
        case "R":
          dispatch({ type: "reveal" });
          break;
        case "l":
        case "L":
          dispatch({ type: "lock" });
          break;
        case "o":
        case "O":
          dispatch({ type: "reopen" });
          break;
        case "d":
        case "D":
          dispatch({ type: "discuss" });
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const question = useMemo(
    () => (state?.step?.type === "question" ? getQuestion(state.step.questionId) : null),
    [state],
  );
  const round = question ? getRound(question.roundId) : null;

  if (hydrated && !token) return <TokenGate code={code} />;

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper">
        <p className="text-ink-3">
          {connection === "closed" ? "That session could not be found." : "Connecting to the room…"}
        </p>
      </main>
    );
  }

  const openPresentation = () =>
    window.open(`/present/${code}`, `team-pulse-present-${code}`, "noopener");

  return (
    <main className="min-h-dvh bg-paper-2">
      <h1 className="sr-only">
        Team Pulse facilitator dashboard — session {code}
      </h1>

      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/" className="rounded-lg">
            <Wordmark size="sm" />
          </Link>

          <span className="flex items-center gap-2">
            <span className="eyebrow text-ink-3">Room</span>
            <span className="tnum rounded-lg bg-ink px-3 py-1 text-lg font-black text-white">
              {code}
            </span>
          </span>

          <span className="hidden text-sm font-semibold text-ink-2 lg:block">
            {stepLabel(state.stepIndex)}
          </span>

          <span className="flex-1" />

          <ConnectionBadge connection={connection} />

          <span className="text-[0.75rem] font-semibold text-ink-3">
            {state.stepIndex + 1} / {state.stepCount}
          </span>

          <Button variant="secondary" size="sm" onClick={openPresentation}>
            Open presentation ↗
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="bg-alert-wash px-6 py-2 text-center text-sm font-semibold text-alert-deep">
          {error}
        </p>
      )}

      <div className="mx-auto grid max-w-[1700px] gap-5 px-6 py-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* Left — where we are */}
        <aside className="flex flex-col gap-5">
          <LiveStats
            counts={state.counts}
            awaitingResponses={Boolean(question)}
            simulatedCount={state.simulatedCount}
          />
          <div className="rounded-2xl bg-surface p-4 shadow-lift ring-1 ring-ink/10 ring-inset">
            <h2 className="sr-only">Session steps</h2>
            <StepNavigator
              state={state}
              onGoto={(stepIndex) => dispatch({ type: "goto", stepIndex })}
              onReset={(questionId) => {
                if (window.confirm("Clear every response for this question?")) {
                  dispatch({ type: "resetStep", questionId });
                }
              }}
            />
          </div>
        </aside>

        {/* Centre — what the room sees, and the controls that change it */}
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="sr-only">What the room is seeing</h2>
          <div className="overflow-hidden rounded-2xl bg-paper shadow-raise ring-1 ring-ink/15 ring-inset">
            <div className="relative aspect-video w-full">
              <iframe
                src={`/present/${code}?preview=1`}
                title="Presentation preview"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
            <h2 className="sr-only">Controls</h2>
            {question && (
              <div className="mb-4">
                <p className="eyebrow text-ink-3">
                  {round ? `Round ${round.index} · ${round.title} · ${question.short}` : ""}
                </p>
                <p className="mt-1 text-lg leading-snug font-bold text-balance text-ink">
                  {question.prompt}
                </p>
                {question.discussPrompt && (
                  <p className="serif-accent mt-2 text-[0.95rem] text-ink-2">
                    Discussion: {question.discussPrompt}
                  </p>
                )}
              </div>
            )}

            <TransportBar state={state} send={dispatch} busy={busy} />

            <p className="mt-4 border-t border-ink/8 pt-3 text-[0.72rem] text-ink-3">
              Shortcuts — <kbd className="font-mono font-bold">→</kbd> next ·{" "}
              <kbd className="font-mono font-bold">←</kbd> back ·{" "}
              <kbd className="font-mono font-bold">R</kbd> reveal ·{" "}
              <kbd className="font-mono font-bold">L</kbd> lock ·{" "}
              <kbd className="font-mono font-bold">O</kbd> reopen ·{" "}
              <kbd className="font-mono font-bold">D</kbd> discuss
            </p>
          </div>
        </section>

        {/* Right — moderation, settings, exports */}
        <aside className="flex flex-col gap-5">
          <ModerationPanel
            items={state.moderation}
            autoApprove={state.autoApprove}
            send={dispatch}
          />
          <SettingsPanel state={state} send={dispatch} busy={busy} />
          <ExportPanel code={code} token={token ?? ""} summary={state.summary} />
        </aside>
      </div>
    </main>
  );
}

/**
 * The dashboard lives on whichever device created the session. If someone
 * opens the host URL elsewhere, they get this rather than the controls.
 */
function TokenGate({ code }: { code: string }) {
  const [value, setValue] = useState("");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 shadow-raise ring-1 ring-ink/10 ring-inset">
        <Wordmark size="sm" />
        <h1 className="display-tight mt-6 text-3xl">This isn&rsquo;t the host device</h1>
        <p className="mt-3 text-ink-2">
          Session <span className="tnum font-bold text-ink">{code}</span> was started on another
          device. Open the dashboard there, or paste the facilitator key below.
        </p>

        <label htmlFor="token" className="eyebrow mt-6 block text-ink-3">
          Facilitator key
        </label>
        <input
          id="token"
          value={value}
          onChange={(e) => setValue(e.target.value.trim())}
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full rounded-xl bg-paper px-4 py-3 font-mono text-sm ring-1 ring-ink/15 ring-inset focus:ring-2 focus:ring-cobalt"
          placeholder="e.g. 9f2c…"
        />

        <Button
          block
          className="mt-4"
          disabled={value.length < 8}
          onClick={() => writeStored(facilitatorKey(code), value)}
        >
          Unlock the dashboard
        </Button>

        <p className="mt-6 text-sm text-ink-3">
          Looking to take part instead?{" "}
          <Link href={`/j/${code}`} className="font-semibold text-cobalt underline">
            Join session {code}
          </Link>
        </p>
      </div>
    </main>
  );
}
