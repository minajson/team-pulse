"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ControlCommand, FacilitatorState } from "@/lib/types";

/**
 * Session settings plus demo mode.
 *
 * "Simulate 30 participants" is here rather than hidden behind a flag: a
 * facilitator should be able to rehearse the whole arc — including the closing
 * screens, which only make sense with real-shaped data — the night before.
 */
export function SettingsPanel({
  state,
  send,
  busy,
}: {
  state: FacilitatorState;
  send: (command: ControlCommand) => void;
  busy: boolean;
}) {
  const [simulating, setSimulating] = useState(false);

  const simulate = (count: number) => {
    setSimulating(true);
    send({ type: "simulate", count });
    window.setTimeout(() => setSimulating(false), 900);
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift ring-1 ring-ink/10 ring-inset">
      <h2 className="text-sm font-bold text-ink">Session settings</h2>

      <div className="mt-3 flex flex-col gap-1">
        <Toggle
          label="Show QR on the projector"
          hint="Turn off once everyone is in"
          checked={state.settings.showQr}
          onChange={(showQr) => send({ type: "settings", patch: { showQr } })}
        />
        <Toggle
          label="App sounds"
          hint="Mutes the projector and every phone"
          checked={state.settings.soundEnabled}
          onChange={(soundEnabled) => send({ type: "settings", patch: { soundEnabled } })}
        />
        <Toggle
          label="Room vs Online callouts"
          hint="“We don't agree” / “Great minds…”"
          checked={state.settings.splitCommentary}
          onChange={(splitCommentary) => send({ type: "settings", patch: { splitCommentary } })}
        />
        <Toggle
          label="Hearts on the response wall"
          checked={state.settings.allowHearts}
          onChange={(allowHearts) => send({ type: "settings", patch: { allowHearts } })}
        />
      </div>

      <div className="mt-4 border-t border-ink/8 pt-4">
        <label
          htmlFor="split-threshold"
          className="flex items-baseline justify-between text-[0.8rem] font-semibold text-ink-2"
        >
          Disagreement threshold
          <span className="tnum font-black text-ink">{state.settings.splitThreshold} pts</span>
        </label>
        <input
          id="split-threshold"
          type="range"
          min={5}
          max={60}
          step={5}
          value={state.settings.splitThreshold}
          disabled={busy}
          onChange={(e) =>
            send({ type: "settings", patch: { splitThreshold: Number(e.target.value) } })
          }
          className="mt-2 h-6 w-full cursor-pointer accent-cobalt"
        />
        <p className="text-[0.72rem] text-ink-3">
          How far apart the room and online must be before the callout fires.
        </p>
      </div>

      <div className="mt-4 border-t border-ink/8 pt-4">
        <h3 className="eyebrow text-ink-3">Demo mode</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || simulating}
            onClick={() => simulate(30)}
          >
            {simulating ? "Filling the room…" : "Simulate 30 participants"}
          </Button>
          {state.simulatedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => send({ type: "clearSimulated" })}
            >
              Clear {state.simulatedCount} simulated
            </Button>
          )}
        </div>
        <p className="mt-2 text-[0.72rem] text-ink-3">
          Fills every round with believable answers so you can rehearse the whole session,
          closing screens included.
        </p>
      </div>

      <div className="mt-4 border-t border-ink/8 pt-4">
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Restart wipes every response and reaction and returns to round 1. Participants stay joined. Continue?",
              )
            ) {
              send({ type: "restart" });
            }
          }}
        >
          Restart session
        </Button>
      </div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-ink/4">
      <span className="min-w-0">
        <span className="block text-[0.84rem] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[0.72rem] text-ink-3">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "block h-6 w-10 rounded-full transition-colors duration-200",
            checked ? "bg-cobalt" : "bg-ink/18",
          )}
        />
        <span
          className={cn(
            "absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}
