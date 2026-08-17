import { optionIdsFor, type Question } from "@/lib/content/session-plan";
import type { JoinMode } from "@/lib/types";

/**
 * Demo-mode answer generator.
 *
 * The goal is a room that looks real on the projector: a clear favourite, a
 * credible second, a long tail — not a flat uniform split. Round 2 gets
 * deliberately different room/online weights so the "WE DON'T AGREE" moment
 * actually fires during a rehearsal.
 */

type Weights = Record<string, number>;

/** Per-question weightings; anything unlisted falls back to a shaped default. */
const WEIGHTS: Record<string, { room: number[]; online: number[] }> = {
  r1q1: { room: [6, 34, 8, 52], online: [9, 30, 10, 51] },
  r1q2: { room: [11, 63, 8, 18], online: [13, 58, 10, 19] },
  r1q3: { room: [9, 14, 66, 11], online: [7, 12, 70, 11] },
  r1q4: { room: [14, 9, 65, 12], online: [17, 11, 60, 12] },
  r1q5: { room: [10, 57, 25, 8], online: [16, 44, 30, 10] },

  // Round 2 — the split round. Gaps here are intentional.
  r2q1: { room: [38, 62], online: [22, 78] },
  r2q2: { room: [44, 56], online: [26, 74] },
  r2q3: { room: [31, 69], online: [55, 45] },
  r2q4: { room: [46, 54], online: [19, 81] },

  // Round 3 — who stays behind.
  r3q1: { room: [46, 6, 33, 15], online: [51, 5, 28, 16] },

  // Round 4 — the $10,000. Two picks each, so these are per-option pull.
  r4q1: { room: [24, 14, 20, 16, 15, 11], online: [22, 11, 25, 15, 16, 11] },

  // Final round priorities.
  r6q1: {
    room: [22, 13, 12, 11, 7, 10, 8, 7, 5, 4, 1],
    online: [26, 14, 11, 9, 6, 12, 7, 6, 5, 3, 1],
  },
};

/** Points allocated to each Team DNA value, before jitter. */
const DNA_BIAS: Record<string, number> = {
  trust: 20,
  communication: 19,
  respect: 13,
  accountability: 12,
  competence: 11,
  leadership: 10,
  innovation: 9,
  fun: 6,
};

const SENTENCES = [
  "listened to each other more",
  "shared information earlier",
  "trusted one another more",
  "celebrated each other's successes",
  "asked for help sooner",
  "worked across our different roles",
  "had more fun together",
  "said the hard thing kindly",
  "made decisions faster together",
  "assumed good intent first",
  "stopped working around each other",
  "gave feedback in the moment",
  "protected each other's focus",
  "welcomed new voices quicker",
  "finished things before starting more",
  "disagreed openly then committed",
  "checked in before checking up",
  "made space for quieter people",
  "explained the why more often",
  "followed through on small promises",
];

function pickWeighted(ids: string[], weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < ids.length; i += 1) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

/** A believable default when a question has no hand-tuned weighting. */
function shapedDefault(count: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.max(2, 40 - i * 9 + Math.random() * 8));
}

function weightsFor(question: Question, mode: JoinMode, count: number): number[] {
  const entry = WEIGHTS[question.id];
  const raw = entry ? (mode === "room" ? entry.room : entry.online) : shapedDefault(count);
  // Jitter so repeated demo runs are not identical.
  return raw.slice(0, count).map((w) => Math.max(0.5, w * (0.85 + Math.random() * 0.3)));
}

export interface SimulatedAnswer {
  optionIds: string[];
  points: Record<string, number> | null;
  text: string | null;
}

export function simulatedResponses(question: Question, mode: JoinMode): SimulatedAnswer | null {
  // A realistic room never has 100% response rate on every question.
  if (Math.random() > 0.93) return null;

  const ids = optionIdsFor(question);

  switch (question.kind) {
    case "single":
    case "split":
    case "profile": {
      const weights = weightsFor(question, mode, ids.length);
      return { optionIds: [pickWeighted(ids, weights)], points: null, text: null };
    }

    case "pick-two": {
      const weights = weightsFor(question, mode, ids.length);
      const first = pickWeighted(ids, weights);
      const remaining = ids.filter((id) => id !== first);
      const remainingWeights = ids
        .map((id, i) => ({ id, w: weights[i] }))
        .filter((x) => x.id !== first)
        .map((x) => x.w);
      const second = pickWeighted(remaining, remainingWeights);
      return { optionIds: [first, second], points: null, text: null };
    }

    case "points": {
      const total = question.pointsTotal ?? 100;
      const values = question.values ?? [];
      const raw = values.map((v) => {
        const bias = DNA_BIAS[v.id] ?? 100 / Math.max(1, values.length);
        return Math.max(1, bias * (0.55 + Math.random() * 0.9));
      });
      const sum = raw.reduce((a, b) => a + b, 0);
      const scaled = raw.map((n) => Math.floor((n / sum) * total));
      // Hand the rounding remainder to the largest allocations, so the result
      // still sums to exactly the required total.
      let remainder = total - scaled.reduce((a, b) => a + b, 0);
      const order = scaled.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n);
      let cursor = 0;
      while (remainder > 0) {
        scaled[order[cursor % order.length].i] += 1;
        remainder -= 1;
        cursor += 1;
      }
      const points: Weights = {};
      values.forEach((v, i) => {
        points[v.id] = scaled[i];
      });
      return { optionIds: [], points, text: null };
    }

    case "open-text": {
      // Not everyone writes something.
      if (Math.random() > 0.72) return null;
      return {
        optionIds: [],
        points: null,
        text: SENTENCES[Math.floor(Math.random() * SENTENCES.length)],
      };
    }

    default:
      return null;
  }
}
