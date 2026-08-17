"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useOrigin } from "@/lib/client/browser-state";
import { cn } from "@/lib/cn";
import type { ControlCommand, FacilitatorState } from "@/lib/types";

/**
 * The controls the facilitator actually touches while talking to a room, sized
 * and grouped so they can be hit without looking down for long.
 *
 * The primary action changes with the phase — while voting is open it is
 * REVEAL, after a reveal it is NEXT — because that is the decision the
 * facilitator is making at that moment.
 */
export function TransportBar({
  state,
  send,
  busy,
}: {
  state: FacilitatorState;
  send: (command: ControlCommand) => void;
  busy: boolean;
}) {
  const onQuestion = state.step?.type === "question";
  const { phase, status } = state;
  const first = state.stepIndex === 0;
  const last = state.stepIndex >= state.stepCount - 1;

  if (status === "lobby") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => send({ type: "start" })} disabled={busy}>
            Start the session
          </Button>
          <p className="text-sm text-ink-3">
            Participants can join now — the projector is showing the QR code.
          </p>
        </div>
        <JoinControls state={state} send={send} busy={busy} />
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-ink/8 px-3 py-1.5 text-sm font-bold text-ink-2">
            Session ended
          </span>
          <Button variant="secondary" onClick={() => send({ type: "restart" })} disabled={busy}>
            Run it again
          </Button>
        </div>
        <JoinControls state={state} send={send} busy={busy} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <JoinControls state={state} send={send} busy={busy} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => send({ type: "back" })}
          disabled={busy || first}
          aria-keyshortcuts="ArrowLeft"
        >
          ← Back
        </Button>

        {onQuestion && phase === "voting" && (
          <Button
            size="lg"
            variant="amber"
            onClick={() => send({ type: "reveal" })}
            disabled={busy}
            aria-keyshortcuts="r"
            className="min-w-44"
          >
            Reveal results
          </Button>
        )}

        {onQuestion && (phase === "revealed" || phase === "discuss") && (
          <Button
            size="lg"
            onClick={() => send({ type: "next" })}
            disabled={busy || last}
            aria-keyshortcuts="ArrowRight"
            className="min-w-44"
          >
            Next →
          </Button>
        )}

        {onQuestion && phase === "locked" && (
          <>
            <Button size="lg" variant="amber" onClick={() => send({ type: "reveal" })} disabled={busy}>
              Reveal results
            </Button>
            <Button variant="secondary" onClick={() => send({ type: "reopen" })} disabled={busy}>
              Reopen
            </Button>
          </>
        )}

        {!onQuestion && (
          <Button
            size="lg"
            onClick={() => send({ type: "next" })}
            disabled={busy || last}
            className="min-w-44"
          >
            Next →
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={() => send({ type: "skip" })}
          disabled={busy || last}
          title="Close this question and move on"
        >
          Skip
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {onQuestion && (
          <>
            <Chip
              active={phase === "voting"}
              onClick={() => send({ type: "reopen" })}
              disabled={busy}
            >
              Open
            </Chip>
            <Chip
              active={phase === "locked"}
              onClick={() => send({ type: "lock" })}
              disabled={busy}
            >
              Lock
            </Chip>
            <Chip
              active={phase === "revealed"}
              onClick={() => send({ type: "reveal" })}
              disabled={busy}
            >
              Reveal
            </Chip>
            <Chip
              active={phase === "discuss"}
              onClick={() => send({ type: "discuss" })}
              disabled={busy}
            >
              Discuss
            </Chip>
            {(phase === "revealed" || phase === "discuss") && (
              <Chip active={false} onClick={() => send({ type: "hide" })} disabled={busy}>
                Hide results
              </Chip>
            )}
            <span className="mx-1 h-5 w-px bg-ink/12" aria-hidden="true" />
          </>
        )}

        {status === "live" ? (
          <Chip active={false} onClick={() => send({ type: "pause" })} disabled={busy}>
            Pause
          </Chip>
        ) : (
          <Chip active onClick={() => send({ type: "resume" })} disabled={busy}>
            Resume
          </Chip>
        )}

        <Chip
          active={false}
          onClick={() => send({ type: "gotoClosing" })}
          disabled={busy}
          title="Jump to the closing screens"
        >
          What did we tell ourselves?
        </Chip>

        <Chip
          active={false}
          tone="danger"
          onClick={() => {
            if (window.confirm("End the session for everyone? Participants will see a closing screen.")) {
              send({ type: "end" });
            }
          }}
          disabled={busy}
        >
          End session
        </Chip>
      </div>
    </div>
  );
}

/**
 * Putting the QR back on the projector for late arrivals.
 *
 * This is a projector overlay, not navigation: the round underneath keeps
 * running, voting stays open, and nothing about the session moves. That matters
 * because the most likely moment to need it is mid-round, when someone walks in
 * late — and losing the room's revealed results to show a QR code would be a
 * bad trade.
 */
function JoinControls({
  state,
  send,
  busy,
}: {
  state: FacilitatorState;
  send: (command: ControlCommand) => void;
  busy: boolean;
}) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const showing = state.overlay === "join";
  const joinUrl = origin ? `${origin}/j/${state.code}` : `/j/${state.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {
      // Clipboard blocked (insecure origin, or permission denied). The link is
      // visible next to the button, so it can still be copied by hand.
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 transition-colors",
        showing ? "bg-amber-wash ring-1 ring-amber/35 ring-inset" : "bg-ink/4",
      )}
    >
      {showing ? (
        <Button size="sm" variant="amber" onClick={() => send({ type: "hideJoin" })} disabled={busy}>
          ← Return to session
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => send({ type: "showJoin" })}
          disabled={busy}
          title="Put the join QR on the projector without changing the round"
        >
          Show join QR
        </Button>
      )}

      <button
        onClick={copy}
        className="h-9 rounded-full bg-ink/6 px-3 text-[0.78rem] font-bold text-ink-2 transition hover:bg-ink/12 hover:text-ink"
      >
        {copied ? "Link copied" : "Copy join link"}
      </button>

      <span className="min-w-0 flex-1 truncate text-[0.72rem] font-medium text-ink-3">
        {showing ? "QR is on the projector — the round is still live underneath." : joinUrl}
      </span>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  disabled,
  title,
  tone = "default",
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full px-3 text-[0.78rem] font-bold transition disabled:opacity-40",
        active
          ? "bg-ink text-white"
          : tone === "danger"
            ? "bg-alert-wash text-alert hover:bg-alert hover:text-white"
            : "bg-ink/6 text-ink-2 hover:bg-ink/12 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
