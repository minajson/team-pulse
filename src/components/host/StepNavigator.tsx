"use client";

import { CLOSING_SCREENS, QUESTIONS, ROUNDS, STEPS } from "@/lib/content/session-plan";
import { cn } from "@/lib/cn";
import type { FacilitatorState, Phase } from "@/lib/types";

const PHASE_LABEL: Record<Phase, string> = {
  voting: "open",
  locked: "locked",
  revealed: "revealed",
  discuss: "discussing",
};

const PHASE_TONE: Record<Phase, string> = {
  voting: "bg-cobalt-wash text-cobalt-deep",
  locked: "bg-ink/8 text-ink-2",
  revealed: "bg-amber-wash text-amber-deep",
  discuss: "bg-positive-wash text-positive-deep",
};

/**
 * Every screen in the session, in order, with its state. Doubles as the
 * "jump directly to any round" control — a facilitator running short on time
 * needs to skip to round 5 without clicking Next eleven times.
 */
export function StepNavigator({
  state,
  onGoto,
  onReset,
}: {
  state: FacilitatorState;
  onGoto: (stepIndex: number) => void;
  onReset: (questionId: string) => void;
}) {
  const progressFor = (questionId: string) =>
    state.progress.find((p) => p.questionId === questionId);

  return (
    <nav aria-label="Session steps" className="flex flex-col gap-4">
      {ROUNDS.map((round) => (
        <section key={round.id}>
          <h3 className="eyebrow px-1 text-ink-3">
            {round.index}. {round.title}
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {round.questions.map((question) => {
              const stepIndex = STEPS.findIndex(
                (s) => s.type === "question" && s.questionId === question.id,
              );
              const active = state.stepIndex === stepIndex;
              const progress = progressFor(question.id);
              const phase = progress?.phase ?? "voting";
              const answered = progress?.responses ?? 0;

              return (
                <li key={question.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-xl px-2.5 py-2 transition",
                      active ? "bg-cobalt text-white" : "hover:bg-ink/6",
                    )}
                  >
                    <button
                      onClick={() => onGoto(stepIndex)}
                      aria-current={active ? "step" : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={cn(
                          "shrink-0 text-[0.7rem] font-black",
                          active ? "text-white/70" : "text-ink-4",
                        )}
                      >
                        {question.short}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[0.82rem] font-semibold",
                          active ? "text-white" : "text-ink-2",
                        )}
                      >
                        {question.prompt}
                      </span>
                    </button>

                    <span
                      className={cn(
                        "tnum shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold",
                        active ? "bg-white/20 text-white" : "bg-ink/8 text-ink-3",
                      )}
                      title={`${answered} responses`}
                    >
                      {answered}
                    </span>

                    {answered > 0 && (
                      <button
                        onClick={() => onReset(question.id)}
                        title={`Clear all responses for ${round.title} ${question.short}`}
                        aria-label={`Reset ${round.title} ${question.short}`}
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
                          active ? "text-white/80 hover:bg-white/20" : "text-alert-deep hover:bg-alert-wash",
                        )}
                      >
                        reset
                      </button>
                    )}

                    {!active && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold",
                          PHASE_TONE[phase],
                        )}
                      >
                        {PHASE_LABEL[phase]}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section>
        <h3 className="eyebrow px-1 text-ink-3">Closing</h3>
        <ul className="mt-1.5 flex flex-col gap-1">
          {CLOSING_SCREENS.map((screen) => {
            const stepIndex = STEPS.findIndex(
              (s) => s.type === "closing" && s.screen === screen.id,
            );
            const active = state.stepIndex === stepIndex;
            return (
              <li key={screen.id}>
                <button
                  onClick={() => onGoto(stepIndex)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "w-full rounded-xl px-2.5 py-2 text-left text-[0.82rem] font-semibold transition",
                    active ? "bg-cobalt text-white" : "text-ink-2 hover:bg-ink/6",
                  )}
                >
                  {screen.title}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="px-1 text-[0.7rem] text-ink-3">
        {QUESTIONS.length} questions · {STEPS.length} screens
      </p>
    </nav>
  );
}
