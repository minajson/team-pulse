import "server-only";
import {
  firstClosingStep,
  firstStepOfRound,
  getQuestion,
  optionIdsFor,
  QUESTIONS,
  selectionBounds,
  STEP_COUNT,
  stepQuestion,
  type Question,
} from "@/lib/content/session-plan";
import { buildFacilitatorState, buildPublicState, WALL_QUESTION_ID } from "@/lib/engine/state";
import { wallKey } from "@/lib/engine/wall";
import { facilitatorToken, joinCode, participantSecret, safeEqual, uuid } from "@/lib/security/ids";
import { moderationVerdict, validateWords } from "@/lib/security/text";
import { getStore } from "@/lib/store";
import {
  DEFAULT_SETTINGS,
  type ControlCommand,
  type FacilitatorState,
  type JoinMode,
  type Participant,
  type Phase,
  type PublicSessionState,
  type ResponseRecord,
  type SessionRecord,
  type SessionSettings,
} from "@/lib/types";
import { simulatedResponses } from "./simulate";

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

const notFound = () => new SessionError("Session not found.", 404);

export function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createSession(title?: string): Promise<SessionRecord> {
  const store = getStore();
  await store.init();

  // Four digits is 10k codes; retry on the rare collision with a live session.
  let code = joinCode();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!(await store.getByCode(code))) break;
    code = joinCode();
  }

  const now = Date.now();
  const record: SessionRecord = {
    id: uuid(),
    code,
    facilitatorToken: facilitatorToken(),
    title: (title ?? "Team Pulse").slice(0, 80),
    status: "lobby",
    stepIndex: 0,
    overlay: null,
    phases: {},
    settings: { ...DEFAULT_SETTINGS },
    revision: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
    participants: [],
    responses: [],
    reactions: [],
  };

  await store.create(record);
  await store.publish(code);
  return record;
}

export async function getSession(code: string): Promise<SessionRecord> {
  const session = await getStore().getByCode(normalizeCode(code));
  if (!session) throw notFound();
  return session;
}

export async function getPublicState(
  code: string,
  participantId?: string,
): Promise<PublicSessionState> {
  return buildPublicState(await getSession(code), { participantId });
}

export async function getFacilitatorState(code: string, token: string): Promise<FacilitatorState> {
  const session = await getSession(code);
  assertFacilitator(session, token);
  return buildFacilitatorState(session);
}

export function assertFacilitator(session: SessionRecord, token: string | null | undefined) {
  if (!token || !safeEqual(session.facilitatorToken, token)) {
    throw new SessionError("Not authorised for this session.", 403);
  }
}

/* ------------------------------------------------------------------ */
/* Join / presence                                                     */
/* ------------------------------------------------------------------ */

export interface JoinResult {
  participantId: string;
  secret: string;
  mode: JoinMode;
  state: PublicSessionState;
}

export async function joinSession(
  code: string,
  mode: JoinMode,
  existing?: { participantId?: string | null; secret?: string | null },
): Promise<JoinResult> {
  const clean = normalizeCode(code);
  const result = await getStore().update(clean, (draft) => {
    if (draft.status === "ended") {
      throw new SessionError("This session has ended.", 410);
    }

    // Reconnect path: a refresh must not create a second participant or lose
    // answers already given.
    if (existing?.participantId && existing.secret) {
      const found = draft.participants.find((p) => p.id === existing.participantId);
      if (found && safeEqual(found.secret, existing.secret)) {
        found.lastSeen = Date.now();
        found.mode = mode;
        // Answers already recorded follow the participant to their new mode.
        for (const r of draft.responses) {
          if (r.participantId === found.id) r.mode = mode;
        }
        return { participant: found };
      }
    }

    if (draft.participants.length >= MAX_PARTICIPANTS) {
      throw new SessionError("This session is full.", 429);
    }

    const participant: Participant = {
      id: uuid(),
      mode,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      simulated: false,
      secret: participantSecret(),
    };
    draft.participants.push(participant);
    return { participant };
  });

  if (!result) throw notFound();
  return {
    participantId: result.value.participant.id,
    secret: result.value.participant.secret,
    mode: result.value.participant.mode,
    state: buildPublicState(result.session, { participantId: result.value.participant.id }),
  };
}

export const MAX_PARTICIPANTS = 1000;

/** Presence ping. Cheap, and deliberately does not broadcast on its own. */
export async function heartbeat(code: string, participantId: string, secret: string) {
  await getStore().update(normalizeCode(code), (draft) => {
    const p = draft.participants.find((x) => x.id === participantId);
    if (!p || !safeEqual(p.secret, secret)) return false;
    p.lastSeen = Date.now();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export interface ResponsePayload {
  optionIds?: unknown;
  points?: unknown;
  text?: unknown;
}

function assertOpen(draft: SessionRecord, question: Question) {
  if (draft.status !== "live") {
    throw new SessionError("This session is not accepting responses right now.", 409);
  }
  const current = stepQuestion(draft.stepIndex);
  if (current?.id !== question.id) {
    throw new SessionError("That question is no longer on screen.", 409);
  }
  const phase: Phase = draft.phases[question.id] ?? "voting";
  if (phase !== "voting") {
    throw new SessionError("Responses are closed for this question.", 409);
  }
}

/** Validates a payload against the question's kind and returns the stored shape. */
function normalizeResponse(
  question: Question,
  payload: ResponsePayload,
  autoApprove: boolean,
): Pick<ResponseRecord, "optionIds" | "points" | "text" | "moderation"> {
  const valid = new Set(optionIdsFor(question));

  if (question.kind === "open-text") {
    const maxWords = question.selection.mode === "text" ? question.selection.maxWords : 6;
    const check = validateWords(payload.text, maxWords);
    if (!check.ok) throw new SessionError(check.error ?? "Invalid response.", 422);
    return {
      optionIds: [],
      points: null,
      text: check.value,
      moderation: moderationVerdict(check.value, autoApprove),
    };
  }

  if (question.kind === "points") {
    const total = question.selection.mode === "points" ? question.selection.total : 100;
    const raw = payload.points;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new SessionError("Invalid allocation.", 422);
    }
    const points: Record<string, number> = {};
    let sum = 0;
    for (const id of valid) {
      const value = (raw as Record<string, unknown>)[id];
      const n = typeof value === "number" ? value : Number(value ?? 0);
      if (!Number.isFinite(n) || n < 0 || n > total || !Number.isInteger(n)) {
        throw new SessionError("Points must be whole numbers between 0 and 100.", 422);
      }
      points[id] = n;
      sum += n;
    }
    if (sum !== total) {
      throw new SessionError(`Your points must add up to exactly ${total}.`, 422);
    }
    return { optionIds: [], points, text: null, moderation: "approved" };
  }

  const ids = Array.isArray(payload.optionIds)
    ? [...new Set(payload.optionIds.map(String))]
    : typeof payload.optionIds === "string"
      ? [payload.optionIds]
      : [];

  const bounds = selectionBounds(question);
  if (!bounds) throw new SessionError("Invalid response.", 422);

  if (ids.length < bounds.min || ids.length > bounds.max) {
    throw new SessionError(
      bounds.min === bounds.max
        ? bounds.min === 1
          ? "Choose one option."
          : `Choose exactly ${bounds.min} options.`
        : `Choose between ${bounds.min} and ${bounds.max} options.`,
      422,
    );
  }
  for (const id of ids) {
    if (!valid.has(id)) throw new SessionError("Unknown option.", 422);
  }

  /*
   * Stored as submitted, always — including round 3, where the participant
   * picks three people to take. Recording what they actually did keeps the
   * echo-back correct on reconnect and keeps the CSV honest; the inversion to
   * "who was left behind" happens once, at tally time.
   */
  return { optionIds: ids, points: null, text: null, moderation: "approved" };
}

export async function submitResponse(
  code: string,
  participantId: string,
  secret: string,
  questionId: string,
  payload: ResponsePayload,
): Promise<PublicSessionState> {
  const question = getQuestion(questionId);
  if (!question) throw new SessionError("Unknown question.", 404);

  const result = await getStore().update(normalizeCode(code), (draft) => {
    const participant = draft.participants.find((p) => p.id === participantId);
    if (!participant || !safeEqual(participant.secret, secret)) {
      throw new SessionError("Rejoin to answer.", 401);
    }
    assertOpen(draft, question);
    participant.lastSeen = Date.now();

    const normalized = normalizeResponse(question, payload, draft.settings.autoApprove);
    const now = Date.now();
    const existing = draft.responses.find(
      (r) => r.questionId === questionId && r.participantId === participantId,
    );

    if (existing) {
      // Changing your mind while voting is open is allowed, and re-opens the
      // moderation decision for text.
      existing.optionIds = normalized.optionIds;
      existing.points = normalized.points;
      existing.text = normalized.text;
      existing.moderation = normalized.moderation;
      existing.mode = participant.mode;
      existing.updatedAt = now;
    } else {
      draft.responses.push({
        id: uuid(),
        questionId,
        participantId,
        mode: participant.mode,
        createdAt: now,
        updatedAt: now,
        ...normalized,
      });
    }
    return { ok: true };
  });

  if (!result) throw notFound();
  return buildPublicState(result.session, { participantId });
}

/* ------------------------------------------------------------------ */
/* Reactions                                                           */
/* ------------------------------------------------------------------ */

export async function toggleReaction(
  code: string,
  participantId: string,
  secret: string,
  responseId: string,
): Promise<PublicSessionState> {
  const result = await getStore().update(normalizeCode(code), (draft) => {
    if (!draft.settings.allowHearts) throw new SessionError("Reactions are off.", 409);
    const participant = draft.participants.find((p) => p.id === participantId);
    if (!participant || !safeEqual(participant.secret, secret)) {
      throw new SessionError("Rejoin to react.", 401);
    }
    const target = draft.responses.find((r) => r.id === responseId);
    if (!target || target.questionId !== WALL_QUESTION_ID) {
      throw new SessionError("Unknown response.", 404);
    }
    if (target.moderation !== "approved") throw new SessionError("Not available.", 409);

    /*
     * The wall consolidates identical statements, so a heart belongs to the
     * statement rather than to one person's copy of it. Un-hearting has to
     * find the reaction wherever it landed, or a participant who hearted one
     * copy could add a second heart by tapping the consolidated entry.
     */
    const key = target.text ? wallKey(target.text) : null;
    const siblings = new Set(
      draft.responses
        .filter(
          (r) =>
            r.questionId === WALL_QUESTION_ID &&
            r.text &&
            (key === null ? r.id === responseId : wallKey(r.text) === key),
        )
        .map((r) => r.id),
    );

    const index = draft.reactions.findIndex(
      (r) => siblings.has(r.responseId) && r.participantId === participantId,
    );
    if (index >= 0) {
      draft.reactions.splice(index, 1);
    } else {
      draft.reactions.push({ responseId, participantId, createdAt: Date.now() });
    }
    participant.lastSeen = Date.now();
    return { ok: true };
  });

  if (!result) throw notFound();
  return buildPublicState(result.session, { participantId });
}

/* ------------------------------------------------------------------ */
/* Facilitator control                                                 */
/* ------------------------------------------------------------------ */

const clampStep = (n: number) => Math.max(0, Math.min(STEP_COUNT - 1, n));

function setPhase(draft: SessionRecord, phase: Phase) {
  const q = stepQuestion(draft.stepIndex);
  if (!q) return;
  draft.phases[q.id] = phase;
}

function sanitizeSettings(patch: Partial<SessionSettings>): Partial<SessionSettings> {
  const out: Partial<SessionSettings> = {};
  if (typeof patch.showQr === "boolean") out.showQr = patch.showQr;
  if (typeof patch.soundEnabled === "boolean") out.soundEnabled = patch.soundEnabled;
  if (typeof patch.splitCommentary === "boolean") out.splitCommentary = patch.splitCommentary;
  if (typeof patch.autoApprove === "boolean") out.autoApprove = patch.autoApprove;
  if (typeof patch.allowHearts === "boolean") out.allowHearts = patch.allowHearts;
  if (typeof patch.splitThreshold === "number" && Number.isFinite(patch.splitThreshold)) {
    out.splitThreshold = Math.max(5, Math.min(60, Math.round(patch.splitThreshold)));
  }
  return out;
}

export async function applyControl(
  code: string,
  token: string,
  command: ControlCommand,
): Promise<FacilitatorState> {
  const result = await getStore().update(normalizeCode(code), (draft) => {
    assertFacilitator(draft, token);

    switch (command.type) {
      case "start":
        draft.status = "live";
        draft.startedAt ??= Date.now();
        draft.stepIndex = 0;
        draft.overlay = null;
        break;

      case "pause":
        if (draft.status === "live") draft.status = "paused";
        break;

      case "resume":
        if (draft.status === "paused") draft.status = "live";
        break;

      case "restart":
        draft.responses = [];
        draft.reactions = [];
        draft.phases = {};
        draft.stepIndex = 0;
        draft.overlay = null;
        draft.status = "live";
        draft.startedAt = Date.now();
        draft.endedAt = null;
        break;

      // Navigating anywhere dismisses the overlay: the facilitator has moved
      // the room on, and leaving the QR up would hide where they moved it to.
      case "next":
        draft.overlay = null;
        draft.stepIndex = clampStep(draft.stepIndex + 1);
        break;

      case "back":
        draft.overlay = null;
        draft.stepIndex = clampStep(draft.stepIndex - 1);
        break;

      case "skip": {
        // Skipping closes the current question so late answers cannot trickle in.
        const q = stepQuestion(draft.stepIndex);
        if (q && (draft.phases[q.id] ?? "voting") === "voting") draft.phases[q.id] = "locked";
        draft.overlay = null;
        draft.stepIndex = clampStep(draft.stepIndex + 1);
        break;
      }

      case "goto":
        draft.overlay = null;
        draft.stepIndex = clampStep(Math.trunc(command.stepIndex));
        break;

      case "gotoRound":
        draft.overlay = null;
        draft.stepIndex = clampStep(firstStepOfRound(command.roundId));
        break;

      case "gotoClosing":
        draft.overlay = null;
        draft.stepIndex = clampStep(firstClosingStep());
        break;

      case "reveal":
        setPhase(draft, "revealed");
        break;

      case "hide":
        setPhase(draft, "locked");
        break;

      case "lock":
        setPhase(draft, "locked");
        break;

      case "reopen":
        setPhase(draft, "voting");
        break;

      case "discuss":
        setPhase(draft, "discuss");
        break;

      /*
       * Overlay only. Deliberately touches nothing else: not stepIndex, not
       * phases, not responses. Returning from it therefore cannot lose the
       * revealed results the room was looking at.
       */
      case "showJoin":
        draft.overlay = "join";
        break;

      case "hideJoin":
        draft.overlay = null;
        break;

      case "end":
        draft.status = "ended";
        draft.endedAt = Date.now();
        draft.stepIndex = STEP_COUNT - 1;
        draft.overlay = null;
        break;

      case "resetStep": {
        const q = command.questionId ? getQuestion(command.questionId) : stepQuestion(draft.stepIndex);
        if (!q) return false;
        const removed = new Set(
          draft.responses.filter((r) => r.questionId === q.id).map((r) => r.id),
        );
        draft.responses = draft.responses.filter((r) => r.questionId !== q.id);
        draft.reactions = draft.reactions.filter((r) => !removed.has(r.responseId));
        draft.phases[q.id] = "voting";
        break;
      }

      case "settings":
        Object.assign(draft.settings, sanitizeSettings(command.patch ?? {}));
        break;

      case "moderate": {
        const target = draft.responses.find((r) => r.id === command.responseId);
        if (!target) return false;
        const allowed = ["approved", "pending", "hidden", "removed"] as const;
        if (!allowed.includes(command.status)) return false;
        target.moderation = command.status;
        if (command.status === "removed") {
          draft.reactions = draft.reactions.filter((r) => r.responseId !== target.id);
        }
        break;
      }

      case "simulate": {
        const count = Math.max(1, Math.min(200, Math.trunc(command.count ?? 30)));
        seedSimulated(draft, count);
        break;
      }

      case "clearSimulated": {
        const ids = new Set(draft.participants.filter((p) => p.simulated).map((p) => p.id));
        draft.participants = draft.participants.filter((p) => !p.simulated);
        const removed = new Set(
          draft.responses.filter((r) => ids.has(r.participantId)).map((r) => r.id),
        );
        draft.responses = draft.responses.filter((r) => !ids.has(r.participantId));
        draft.reactions = draft.reactions.filter(
          (r) => !ids.has(r.participantId) && !removed.has(r.responseId),
        );
        break;
      }

      default:
        return false;
    }
    return { ok: true };
  });

  if (!result) throw notFound();
  return buildFacilitatorState(result.session);
}

/* ------------------------------------------------------------------ */
/* Demo mode                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fills the session with believable answers from simulated participants so the
 * whole experience — including the closing screens — can be rehearsed without
 * an audience. Simulated participants are flagged and removable in one click.
 */
function seedSimulated(draft: SessionRecord, count: number) {
  const now = Date.now();
  const created: Participant[] = [];

  for (let i = 0; i < count; i += 1) {
    // Roughly the room/online mix a hybrid session actually sees.
    const mode: JoinMode = Math.random() < 0.62 ? "room" : "online";
    const participant: Participant = {
      id: uuid(),
      mode,
      joinedAt: now - Math.floor(Math.random() * 120_000),
      lastSeen: now,
      simulated: true,
      secret: participantSecret(),
    };
    draft.participants.push(participant);
    created.push(participant);
  }

  for (const question of QUESTIONS) {
    for (const participant of created) {
      const generated = simulatedResponses(question, participant.mode);
      if (!generated) continue;
      draft.responses.push({
        id: uuid(),
        questionId: question.id,
        participantId: participant.id,
        mode: participant.mode,
        createdAt: now,
        updatedAt: now,
        optionIds: generated.optionIds,
        points: generated.points,
        text: generated.text,
        moderation: generated.text ? "approved" : "approved",
      });
    }
  }

  // A plausible spread of hearts on the wall.
  const wall = draft.responses.filter((r) => r.questionId === WALL_QUESTION_ID);
  for (const entry of wall) {
    const admirers = created.filter(() => Math.random() < 0.22);
    for (const p of admirers) {
      if (p.id === entry.participantId) continue;
      draft.reactions.push({ responseId: entry.id, participantId: p.id, createdAt: now });
    }
  }
}
