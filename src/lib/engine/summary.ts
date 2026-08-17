import {
  getQuestion,
  getRound,
  PROFILES,
  QUESTIONS,
  TEAM_VALUES,
  type Question,
} from "@/lib/content/session-plan";
import type { SessionRecord, SessionSummary, SummaryInsight, SummaryValueLine } from "@/lib/types";
import { countableResponses, tallyQuestion } from "./tally";
import { wallKey } from "./wall";

const round1 = (n: number) => Math.round(n * 10) / 10;

export function optionLabel(question: Question, optionId: string): string {
  const option = question.options?.find((o) => o.id === optionId);
  if (option) return option.label;
  const profile = question.profiles?.find((p) => p.id === optionId);
  if (profile) return `${profile.name} — ${profile.title}`;
  const value = question.values?.find((v) => v.id === optionId);
  if (value) return value.label;
  return optionId;
}

function hueFor(id: string, fallback: number): number {
  return TEAM_VALUES.find((v) => v.id === id)?.hue ?? fallback;
}

/**
 * Derives the three closing screens from the session's own data.
 *
 * Deliberately descriptive: it reports what the room chose and where it
 * differed. It does not classify people or infer traits.
 */
export function buildSummary(session: SessionRecord): SessionSummary {
  const participants = session.participants;

  const investmentQ = getQuestion("r4q1");
  const dnaQ = getQuestion("r5q1");
  const priorityQ = getQuestion("r6q1");
  const textQ = getQuestion("r6q2");

  const investments: SummaryValueLine[] = investmentQ
    ? tallyQuestion(session, investmentQ)
        .options.filter((o) => o.count > 0)
        .sort((a, b) => b.pct - a.pct)
        .map((o, i) => ({
          label: optionLabel(investmentQ, o.optionId),
          pct: round1(o.pct),
          hue: [40, 152, 222, 282, 192, 328][i % 6],
        }))
    : [];

  const dna: SummaryValueLine[] = dnaQ
    ? tallyQuestion(session, dnaQ)
        .points.filter((p) => p.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .map((p) => ({
          label: optionLabel(dnaQ, p.valueId),
          pct: round1(p.pct),
          hue: hueFor(p.valueId, 222),
        }))
    : [];

  return {
    code: session.code,
    title: session.title,
    generatedAt: Date.now(),
    participants: {
      total: participants.length,
      room: participants.filter((p) => p.mode === "room").length,
      online: participants.filter((p) => p.mode === "online").length,
    },
    values: { investments, dna },
    thinking: {
      strongestAgreement: strongestAgreement(session),
      biggestDivide: biggestDivide(session),
      decisionPattern: decisionPattern(session),
    },
    voice: {
      topStatements: textQ ? topStatements(session, textQ.id) : [],
      topPriority: priorityQ ? topChoiceInsight(session, priorityQ) : null,
    },
  };
}

/**
 * The five most-hearted sentences.
 *
 * Identical sentences are merged and their hearts summed. Two people
 * independently writing "listened to each other more" is a stronger signal
 * than either one alone — showing it twice on the closing screen reads as a
 * bug and wastes one of only five slots.
 */
function topStatements(session: SessionRecord, questionId: string) {
  const merged = new Map<string, { text: string; hearts: number; voices: number }>();

  for (const r of countableResponses(session, questionId)) {
    if (r.moderation !== "approved" || !r.text) continue;
    const key = wallKey(r.text);
    const hearts = session.reactions.filter((x) => x.responseId === r.id).length;
    const existing = merged.get(key);
    if (existing) {
      existing.hearts += hearts;
      existing.voices += 1;
    } else {
      merged.set(key, { text: r.text, hearts, voices: 1 });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.hearts - a.hearts || b.voices - a.voices || a.text.localeCompare(b.text))
    .slice(0, 5)
    .map(({ text, hearts }) => ({ text, hearts }));
}

/** The single choice, across all single-answer questions, with the widest consensus. */
function strongestAgreement(session: SessionRecord): SummaryInsight | null {
  let best: { q: Question; optionId: string; pct: number; n: number } | null = null;

  for (const q of QUESTIONS) {
    if (q.kind !== "single" && q.kind !== "split") continue;
    const results = tallyQuestion(session, q);
    if (results.totalResponses < 1) continue;
    for (const o of results.options) {
      if (!best || o.pct > best.pct) {
        best = { q, optionId: o.optionId, pct: o.pct, n: results.totalResponses };
      }
    }
  }

  if (!best || best.pct <= 0) return null;
  const roundLabel = getRound(best.q.roundId)?.title ?? "";
  return {
    stat: `${Math.round(best.pct)}%`,
    label: "Where we agreed most",
    question: best.q.prompt,
    detail: `In ${roundLabel} — “${best.q.prompt}” — ${Math.round(best.pct)}% chose “${optionLabel(
      best.q,
      best.optionId,
    )}”.`,
  };
}

/** The round-2 question where the room and the online half diverged most. */
function biggestDivide(session: SessionRecord): SummaryInsight | null {
  let best: { q: Question; optionId: string; gap: number; roomPct: number; onlinePct: number } | null =
    null;

  for (const q of QUESTIONS) {
    if (q.kind !== "split") continue;
    const results = tallyQuestion(session, q);
    if (!results.split || results.split.verdict === "insufficient") continue;
    const optionId = results.split.optionId;
    if (!optionId) continue;
    const option = results.options.find((o) => o.optionId === optionId);
    if (!option) continue;
    if (!best || results.split.maxGap > best.gap) {
      best = {
        q,
        optionId,
        gap: results.split.maxGap,
        roomPct: option.roomPct,
        onlinePct: option.onlinePct,
      };
    }
  }

  if (!best) return null;

  const label = optionLabel(best.q, best.optionId);
  const gap = Math.round(best.gap);
  if (best.gap < 10) {
    return {
      stat: `${gap} points`,
      label: "Where room & online agreed most",
      question: best.q.prompt,
      detail: `On “${best.q.prompt}” the two groups landed within ${gap} points of each other on “${label}”.`,
    };
  }
  return {
    stat: `${gap} points`,
    label: "Where room & online saw things differently",
    question: best.q.prompt,
    detail: `On “${best.q.prompt}”, ${Math.round(best.roomPct)}% in the room chose “${label}” — online it was ${Math.round(
      best.onlinePct,
    )}%.`,
  };
}

/** Who the team most often left behind, stated as a choice rather than a judgement. */
function decisionPattern(session: SessionRecord): SummaryInsight | null {
  const q = getQuestion("r3q1");
  if (!q) return null;
  const results = tallyQuestion(session, q);
  if (results.totalResponses < 1) return null;
  const top = [...results.options].sort((a, b) => b.pct - a.pct)[0];
  if (!top || top.count === 0) return null;
  const profile = PROFILES.find((p) => p.id === top.optionId);
  if (!profile) return null;
  return {
    stat: `${Math.round(top.pct)}%`,
    label: `Left ${profile.name} behind`,
    question: "You have one critical project. Who stays behind?",
    detail: `Given three seats, the team most often set aside ${profile.name} — ${profile.title.toLowerCase()}.`,
  };
}

function topChoiceInsight(session: SessionRecord, question: Question): SummaryInsight | null {
  const results = tallyQuestion(session, question);
  if (results.totalResponses < 1) return null;
  const top = [...results.options].sort((a, b) => b.pct - a.pct)[0];
  if (!top || top.count === 0) return null;
  return {
    stat: `${Math.round(top.pct)}%`,
    label: optionLabel(question, top.optionId),
    question: question.prompt,
    detail: `${Math.round(top.pct)}% of the team named “${optionLabel(
      question,
      top.optionId,
    )}” as the one thing that would make us stronger.`,
  };
}
