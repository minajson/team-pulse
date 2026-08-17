import {
  getQuestion,
  QUESTIONS,
  STEP_COUNT,
  getStep,
  stepQuestion,
} from "@/lib/content/session-plan";
import type {
  FacilitatorState,
  ModerationItem,
  Phase,
  PublicSessionState,
  SessionRecord,
  SessionSettings,
  WallItem,
} from "@/lib/types";
import { buildSummary } from "./summary";
import { hasLiveVisualisation, responseCount, tallyQuestion } from "./tally";
import { wallKey } from "./wall";

export const WALL_QUESTION_ID = "r6q2";

export function phaseOf(session: SessionRecord, questionId: string | null): Phase {
  if (!questionId) return "revealed";
  return session.phases[questionId] ?? "voting";
}

export function currentPhase(session: SessionRecord): Phase {
  const q = stepQuestion(session.stepIndex);
  return phaseOf(session, q?.id ?? null);
}

function heartsFor(session: SessionRecord, responseId: string): number {
  let n = 0;
  for (const r of session.reactions) if (r.responseId === responseId) n += 1;
  return n;
}

/**
 * Approved free-text entries, most-supported first.
 *
 * Identical statements are consolidated into one entry whose hearts are the
 * sum across every copy. The earliest copy becomes the representative — it owns
 * the id, so a heart tapped on the wall always lands on a real response.
 */
export function buildWall(session: SessionRecord, participantId?: string): WallItem[] {
  const groups = new Map<string, WallItem>();

  for (const r of session.responses) {
    if (r.questionId !== WALL_QUESTION_ID || r.moderation !== "approved" || !r.text) continue;

    const key = wallKey(r.text);
    const hearts = heartsFor(session, r.id);
    const mine = participantId
      ? session.reactions.some((x) => x.responseId === r.id && x.participantId === participantId)
      : false;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: r.id,
        text: r.text,
        hearts,
        voices: 1,
        createdAt: r.createdAt,
        hearted: mine,
      });
      continue;
    }

    existing.hearts += hearts;
    existing.voices += 1;
    existing.hearted = existing.hearted || mine;
    // The earliest copy represents the group, so the id is stable as more
    // people write the same thing.
    if (r.createdAt < existing.createdAt) {
      existing.id = r.id;
      existing.text = r.text;
      existing.createdAt = r.createdAt;
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.hearts - a.hearts || b.voices - a.voices || b.createdAt - a.createdAt,
  );
}

/**
 * A participant's own answer, echoed back to them alone. This is what makes a
 * mid-round refresh survivable: the phone reconnects and their selection is
 * already there.
 */
function buildOwnAnswer(
  session: SessionRecord,
  questionId: string | undefined,
  participantId: string | undefined,
): PublicSessionState["you"] {
  if (!questionId || !participantId) return null;
  const mine = session.responses.find(
    (r) => r.questionId === questionId && r.participantId === participantId,
  );
  if (!mine) {
    return { answered: false, optionIds: [], points: null, text: null, moderation: null };
  }
  return {
    answered: mine.moderation !== "removed",
    optionIds: mine.optionIds,
    points: mine.points,
    text: mine.text,
    moderation: mine.moderation,
  };
}

export function buildPublicState(
  session: SessionRecord,
  opts: { participantId?: string } = {},
): PublicSessionState {
  const step = getStep(session.stepIndex);
  const question = stepQuestion(session.stepIndex);
  const phase = phaseOf(session, question?.id ?? null);

  const revealed = phase === "revealed" || phase === "discuss";
  const showResults = Boolean(question) && (revealed || hasLiveVisualisation(question!));

  const participants = session.participants;
  // autoApprove is a facilitator-only setting and is stripped here.
  const publicSettings: Omit<SessionSettings, "autoApprove"> = {
    showQr: session.settings.showQr,
    soundEnabled: session.settings.soundEnabled,
    splitCommentary: session.settings.splitCommentary,
    splitThreshold: session.settings.splitThreshold,
    allowHearts: session.settings.allowHearts,
  };

  // The wall is live during its own step; before that it stays empty so an
  // early answer cannot leak onto the projector.
  const wallVisible =
    step?.type === "closing" ||
    (step?.type === "question" && step.questionId === WALL_QUESTION_ID);

  return {
    code: session.code,
    title: session.title,
    status: session.status,
    stepIndex: session.stepIndex,
    stepCount: STEP_COUNT,
    step,
    phase,
    overlay: session.overlay ?? null,
    counts: {
      total: participants.length,
      room: participants.filter((p) => p.mode === "room").length,
      online: participants.filter((p) => p.mode === "online").length,
      responses: question ? responseCount(session, question.id) : 0,
    },
    settings: publicSettings,
    results: showResults && question ? tallyQuestion(session, question) : null,
    you: buildOwnAnswer(session, question?.id, opts.participantId),
    wall: wallVisible ? buildWall(session, opts.participantId) : [],
    summary: step?.type === "closing" ? buildSummary(session) : null,
    serverTime: Date.now(),
    revision: session.revision ?? 0,
  };
}

export function buildFacilitatorState(session: SessionRecord): FacilitatorState {
  const base = buildPublicState(session);
  const wallQuestion = getQuestion(WALL_QUESTION_ID);

  const moderation: ModerationItem[] = wallQuestion
    ? session.responses
        .filter((r) => r.questionId === WALL_QUESTION_ID && r.text)
        .map<ModerationItem>((r) => ({
          id: r.id,
          text: r.text as string,
          moderation: r.moderation,
          hearts: heartsFor(session, r.id),
          createdAt: r.createdAt,
          mode: r.mode,
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  return {
    ...base,
    // The facilitator always sees the full wall, including pending items.
    wall: buildWall(session),
    // ...and can always export, not only once the closing screens are up. The
    // public state still withholds this until the session reaches them.
    summary: buildSummary(session),
    progress: QUESTIONS.map((q) => ({
      questionId: q.id,
      responses: responseCount(session, q.id),
      phase: phaseOf(session, q.id),
    })),
    moderation,
    autoApprove: session.settings.autoApprove,
    simulatedCount: session.participants.filter((p) => p.simulated).length,
  };
}
