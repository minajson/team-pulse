import { optionIdsFor, type Question } from "@/lib/content/session-plan";
import type {
  OptionTally,
  PointsTally,
  QuestionResults,
  ResponseRecord,
  SessionRecord,
  SplitVerdict,
} from "@/lib/types";

/**
 * Below this many responses on either side, a room-vs-online gap is noise —
 * one remote participant should not trigger "WE DON'T AGREE".
 */
export const MIN_SPLIT_SAMPLE = 3;

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Responses that count toward results: submitted, and not moderated away. */
export function countableResponses(session: SessionRecord, questionId: string): ResponseRecord[] {
  return session.responses.filter(
    (r) => r.questionId === questionId && r.moderation !== "removed" && r.moderation !== "hidden",
  );
}

export function responseCount(session: SessionRecord, questionId: string): number {
  return session.responses.filter(
    (r) => r.questionId === questionId && r.moderation !== "removed",
  ).length;
}

export function tallyQuestion(session: SessionRecord, question: Question): QuestionResults {
  const responses = countableResponses(session, question.id);
  const roomResponses = responses.filter((r) => r.mode === "room");
  const onlineResponses = responses.filter((r) => r.mode === "online");

  const base: QuestionResults = {
    questionId: question.id,
    totalResponses: responses.length,
    roomResponses: roomResponses.length,
    onlineResponses: onlineResponses.length,
    options: [],
    points: [],
    split: null,
  };

  if (question.kind === "points") {
    base.points = tallyPoints(question, responses);
    return base;
  }

  if (question.kind === "open-text") {
    return base;
  }

  const ids = optionIdsFor(question);
  const multi = (question.selectCount ?? 1) > 1;

  const tick = (list: ResponseRecord[]) => {
    const counts = new Map<string, number>(ids.map((id) => [id, 0]));
    let selections = 0;
    for (const r of list) {
      for (const id of r.optionIds) {
        if (!counts.has(id)) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        selections += 1;
      }
    }
    return { counts, selections };
  };

  const all = tick(responses);
  const room = tick(roomResponses);
  const online = tick(onlineResponses);

  /**
   * Single-select rounds read naturally as "share of the team". Multi-select
   * ($10,000) reads as "share of the pot", so its denominator is selections.
   */
  const denom = multi ? all.selections : responses.length;
  const roomDenom = multi ? room.selections : roomResponses.length;
  const onlineDenom = multi ? online.selections : onlineResponses.length;

  base.options = ids.map<OptionTally>((optionId) => ({
    optionId,
    count: all.counts.get(optionId) ?? 0,
    pct: pct(all.counts.get(optionId) ?? 0, denom),
    roomCount: room.counts.get(optionId) ?? 0,
    roomPct: pct(room.counts.get(optionId) ?? 0, roomDenom),
    onlineCount: online.counts.get(optionId) ?? 0,
    onlinePct: pct(online.counts.get(optionId) ?? 0, onlineDenom),
  }));

  if (question.kind === "split") {
    base.split = splitVerdict(base.options, roomResponses.length, onlineResponses.length, session.settings.splitThreshold);
  }

  return base;
}

function tallyPoints(question: Question, responses: ResponseRecord[]): PointsTally[] {
  const values = question.values ?? [];
  const sums = new Map<string, number>(values.map((v) => [v.id, 0]));
  let grandTotal = 0;

  for (const r of responses) {
    if (!r.points) continue;
    for (const [valueId, amount] of Object.entries(r.points)) {
      if (!sums.has(valueId)) continue;
      const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      sums.set(valueId, (sums.get(valueId) ?? 0) + safe);
      grandTotal += safe;
    }
  }

  return values.map<PointsTally>((v) => ({
    valueId: v.id,
    mean: responses.length > 0 ? (sums.get(v.id) ?? 0) / responses.length : 0,
    pct: pct(sums.get(v.id) ?? 0, grandTotal),
  }));
}

function splitVerdict(
  options: OptionTally[],
  roomCount: number,
  onlineCount: number,
  threshold: number,
): QuestionResults["split"] {
  if (roomCount < MIN_SPLIT_SAMPLE || onlineCount < MIN_SPLIT_SAMPLE) {
    return { verdict: "insufficient" as SplitVerdict, maxGap: 0, optionId: null };
  }
  let maxGap = 0;
  let optionId: string | null = null;
  for (const o of options) {
    const gap = Math.abs(o.roomPct - o.onlinePct);
    if (gap > maxGap) {
      maxGap = gap;
      optionId = o.optionId;
    }
  }
  return {
    verdict: maxGap >= threshold ? "disagree" : "agree",
    maxGap,
    optionId,
  };
}

/** Rounds whose projector visualisation builds while voting is still open. */
export function hasLiveVisualisation(question: Question): boolean {
  return question.kind === "pick-two" || question.kind === "points";
}
