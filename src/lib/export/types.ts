import type { QuestionKind } from "@/lib/content/session-plan";
import type { QuestionResults, SessionSummary } from "@/lib/types";

/** Shape returned by GET /api/sessions/[code]/export?format=json. */
export interface DeckExport {
  session: {
    code: string;
    title: string;
    startedAt: number | null;
    endedAt: number | null;
    exportedAt: number;
  };
  participants: { total: number; room: number; online: number };
  rounds: Array<{
    round?: number;
    roundTitle?: string;
    questionId: string;
    kind: QuestionKind;
    prompt: string;
    totalResponses: number;
    roomResponses: number;
    onlineResponses: number;
    options: Array<{ label: string; count: number; pct: number; roomPct: number; onlinePct: number }>;
    points: Array<{ label: string; mean: number; pct: number }>;
    split: QuestionResults["split"];
  }>;
  wall: Array<{ text: string | null; hearts: number }>;
  summary: SessionSummary;
}
