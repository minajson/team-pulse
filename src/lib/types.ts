import type { ClosingScreenId, RoundId, Step } from "@/lib/content/session-plan";

export type SessionStatus = "lobby" | "live" | "paused" | "ended";

/**
 * A temporary takeover of the projector that leaves the session running
 * underneath it. Used so a facilitator can put the join QR back on screen for
 * late arrivals without disturbing the round in progress.
 */
export type Overlay = "join" | null;

/** Per-question lifecycle, controlled by the facilitator. */
export type Phase = "voting" | "locked" | "revealed" | "discuss";

export type JoinMode = "room" | "online";

export type ModerationStatus = "approved" | "pending" | "hidden" | "removed";

export interface Participant {
  id: string;
  mode: JoinMode;
  joinedAt: number;
  lastSeen: number;
  simulated: boolean;
  /**
   * Issued once at join and kept only on the server + that participant's own
   * device. Proves "this answer is mine" without ever identifying who they are.
   */
  secret: string;
}

/**
 * One participant's answer to one question. Shape depends on question kind:
 *  - single / split / profile / pick-two → `optionIds`
 *  - points                             → `points`
 *  - open-text                          → `text`
 */
export interface ResponseRecord {
  id: string;
  questionId: string;
  participantId: string;
  mode: JoinMode;
  optionIds: string[];
  points: Record<string, number> | null;
  text: string | null;
  moderation: ModerationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ReactionRecord {
  responseId: string;
  participantId: string;
  createdAt: number;
}

export interface SessionSettings {
  /** Show the QR / join panel on the projector. */
  showQr: boolean;
  /** Master mute for app sounds (projector + participants). */
  soundEnabled: boolean;
  /** Enable the "WE DON'T AGREE" / "GREAT MINDS" callouts in round 2. */
  splitCommentary: boolean;
  /** Percentage-point gap that counts as disagreement. */
  splitThreshold: number;
  /** Auto-approve free text that passes the profanity filter. */
  autoApprove: boolean;
  /** Allow hearts on the live response wall. */
  allowHearts: boolean;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  showQr: true,
  soundEnabled: true,
  splitCommentary: true,
  splitThreshold: 20,
  autoApprove: true,
  allowHearts: true,
};

export interface SessionRecord {
  id: string;
  code: string;
  facilitatorToken: string;
  title: string;
  status: SessionStatus;
  stepIndex: number;
  /** Covers the projector without changing what is underneath. */
  overlay: Overlay;
  /** questionId → phase. Missing means "voting". */
  phases: Record<string, Phase>;
  settings: SessionSettings;
  /** Bumped on every persisted mutation. Clients use it to detect stale frames. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  participants: Participant[];
  responses: ResponseRecord[];
  reactions: ReactionRecord[];
}

/* ------------------------------------------------------------------ */
/* Public (client-facing) shapes — never include identity or tokens    */
/* ------------------------------------------------------------------ */

export interface LiveCounts {
  total: number;
  room: number;
  online: number;
  /** Participants who have answered the current question. */
  responses: number;
}

export interface OptionTally {
  optionId: string;
  count: number;
  pct: number;
  roomCount: number;
  roomPct: number;
  onlineCount: number;
  onlinePct: number;
}

export interface PointsTally {
  valueId: string;
  /** Mean points allocated, 0–100. */
  mean: number;
  /** Share of the total 100-point budget, as a percentage. */
  pct: number;
}

export type SplitVerdict = "agree" | "disagree" | "insufficient";

export interface QuestionResults {
  questionId: string;
  totalResponses: number;
  roomResponses: number;
  onlineResponses: number;
  options: OptionTally[];
  points: PointsTally[];
  /** Round 2 only. */
  split: {
    verdict: SplitVerdict;
    /** Largest room-vs-online gap in percentage points. */
    maxGap: number;
    optionId: string | null;
  } | null;
}

export interface WallItem {
  /** The representative response for this statement — what a heart targets. */
  id: string;
  text: string;
  /** Hearts across every participant who wrote this same statement. */
  hearts: number;
  /** How many people wrote it. 1 for most; higher when it was consolidated. */
  voices: number;
  createdAt: number;
  /** True when the requesting participant has hearted any copy of it. */
  hearted: boolean;
}

export interface PublicSessionState {
  code: string;
  title: string;
  status: SessionStatus;
  stepIndex: number;
  stepCount: number;
  step: Step | null;
  phase: Phase;
  /**
   * When set, the projector shows this instead of the current step. The step,
   * phase and every response underneath are untouched, so participants can
   * keep answering while the QR is up.
   */
  overlay: Overlay;
  counts: LiveCounts;
  settings: Omit<SessionSettings, "autoApprove">;
  /**
   * Present when the facilitator has revealed, or when the round is one of the
   * live-visualised rounds ($10,000 / Team DNA) where motion builds during
   * voting. Clients must only render *numbers* once `phase` is revealed.
   */
  results: QuestionResults | null;
  /**
   * The requesting participant's own answer to the current question, so a
   * refresh mid-round restores what they chose. Never populated for the
   * projector, and never contains anyone else's answer.
   */
  you: {
    answered: boolean;
    optionIds: string[];
    points: Record<string, number> | null;
    text: string | null;
    moderation: ModerationStatus | null;
  } | null;
  /** Approved open-text entries for the live wall. */
  wall: WallItem[];
  /** Populated on closing steps. */
  summary: SessionSummary | null;
  serverTime: number;
  /** Bumped on every mutation — clients use it to detect missed frames. */
  revision: number;
}

/* ------------------------------------------------------------------ */
/* Closing summary                                                     */
/* ------------------------------------------------------------------ */

export interface SummaryValueLine {
  label: string;
  pct: number;
  hue: number;
}

export interface SummaryInsight {
  /**
   * The single number that carries the point — "78%", "42 points".
   * Split out from the prose so the projector can lead with it and leave the
   * explaining to the facilitator.
   */
  stat: string;
  /** What the number is: "Where we agreed most". */
  label: string;
  /** The question it came from. Shown small on the projector, in full in exports. */
  question: string;
  /** The full sentence. Used by the PDF, where there is room to read. */
  detail: string;
}

export interface SessionSummary {
  code: string;
  title: string;
  generatedAt: number;
  participants: { total: number; room: number; online: number };
  /** Screen 1 — from the $10,000 round and Team DNA. */
  values: {
    investments: SummaryValueLine[];
    dna: SummaryValueLine[];
  };
  /** Screen 2 — from You Decide, Room vs Online, Who Would You Pick. */
  thinking: {
    strongestAgreement: SummaryInsight | null;
    biggestDivide: SummaryInsight | null;
    decisionPattern: SummaryInsight | null;
  };
  /** Screen 3 — top hearted statements. */
  voice: {
    topStatements: { text: string; hearts: number }[];
    topPriority: SummaryInsight | null;
  };
}

/* ------------------------------------------------------------------ */
/* Facilitator-only view                                               */
/* ------------------------------------------------------------------ */

export interface ModerationItem {
  id: string;
  text: string;
  moderation: ModerationStatus;
  hearts: number;
  createdAt: number;
  mode: JoinMode;
}

export interface FacilitatorState extends PublicSessionState {
  /** Per-step response counts, so the facilitator can see progress at a glance. */
  progress: { questionId: string; responses: number; phase: Phase }[];
  moderation: ModerationItem[];
  autoApprove: boolean;
  simulatedCount: number;
}

/* ------------------------------------------------------------------ */
/* Control commands                                                    */
/* ------------------------------------------------------------------ */

export type ControlCommand =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "next" }
  | { type: "back" }
  | { type: "skip" }
  | { type: "goto"; stepIndex: number }
  | { type: "gotoRound"; roundId: RoundId }
  | { type: "gotoClosing"; screen?: ClosingScreenId }
  | { type: "reveal" }
  | { type: "hide" }
  | { type: "lock" }
  | { type: "reopen" }
  | { type: "discuss" }
  | { type: "showJoin" }
  | { type: "hideJoin" }
  | { type: "end" }
  | { type: "resetStep"; questionId?: string }
  | { type: "settings"; patch: Partial<SessionSettings> }
  | { type: "moderate"; responseId: string; status: ModerationStatus }
  | { type: "simulate"; count?: number }
  | { type: "clearSimulated" };
