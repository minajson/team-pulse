import { getRound, QUESTIONS } from "@/lib/content/session-plan";
import { buildSummary, optionLabel } from "@/lib/engine/summary";
import { tallyQuestion } from "@/lib/engine/tally";
import { facilitatorAuth, handleError, json } from "@/lib/http";
import { assertFacilitator, getSession, SessionError } from "@/lib/session/service";
import type { SessionRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exports carry no respondent key at all — not even a pseudonymous one.
 * With a team of twelve, a stable per-person id across six rounds is an
 * identity in everything but name, and this product only works if people
 * believe that. Rows are shuffled for the same reason.
 */
function toCsv(session: SessionRecord): string {
  const header = [
    "round",
    "round_title",
    "question_id",
    "question",
    "joined_from",
    "answer",
    "points",
    "text",
    "hearts",
  ];

  const rows: string[][] = [];
  for (const question of QUESTIONS) {
    const round = getRound(question.roundId);
    for (const r of session.responses) {
      if (r.questionId !== question.id) continue;
      if (r.moderation === "removed") continue;
      rows.push([
        String(round?.index ?? ""),
        round?.title ?? "",
        question.id,
        question.prompt,
        r.mode,
        r.optionIds.map((id) => optionLabel(question, id)).join(" | "),
        r.points ? JSON.stringify(r.points) : "",
        r.text ?? "",
        String(session.reactions.filter((x) => x.responseId === r.id).length),
      ]);
    }
  }

  // Fisher–Yates, so row order cannot be read back as submission order.
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Quotes the cell and defuses spreadsheet formula injection. */
function csvCell(value: string): string {
  const raw = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Everything a slide deck generator would need, with no identities in it. */
function toDeckJson(session: SessionRecord) {
  return {
    session: {
      code: session.code,
      title: session.title,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      exportedAt: Date.now(),
    },
    participants: {
      total: session.participants.length,
      room: session.participants.filter((p) => p.mode === "room").length,
      online: session.participants.filter((p) => p.mode === "online").length,
    },
    rounds: QUESTIONS.map((question) => {
      const results = tallyQuestion(session, question);
      const round = getRound(question.roundId);
      return {
        round: round?.index,
        roundTitle: round?.title,
        questionId: question.id,
        kind: question.kind,
        prompt: question.prompt,
        totalResponses: results.totalResponses,
        roomResponses: results.roomResponses,
        onlineResponses: results.onlineResponses,
        options: results.options.map((o) => ({
          label: optionLabel(question, o.optionId),
          count: o.count,
          pct: Math.round(o.pct * 10) / 10,
          roomPct: Math.round(o.roomPct * 10) / 10,
          onlinePct: Math.round(o.onlinePct * 10) / 10,
        })),
        points: results.points.map((p) => ({
          label: optionLabel(question, p.valueId),
          mean: Math.round(p.mean * 10) / 10,
          pct: Math.round(p.pct * 10) / 10,
        })),
        split: results.split,
      };
    }),
    wall: session.responses
      .filter((r) => r.questionId === "r6q2" && r.moderation === "approved" && r.text)
      .map((r) => ({
        text: r.text,
        hearts: session.reactions.filter((x) => x.responseId === r.id).length,
      }))
      .sort((a, b) => b.hearts - a.hearts),
    summary: buildSummary(session),
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const session = await getSession(code);
    assertFacilitator(session, facilitatorAuth(req));

    const format = new URL(req.url).searchParams.get("format") ?? "json";
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      return new Response(toCsv(session), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="team-pulse-${session.code}-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    if (format === "summary") {
      return json(buildSummary(session));
    }

    if (format === "json" || format === "deck") {
      return new Response(JSON.stringify(toDeckJson(session), null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="team-pulse-${session.code}-${stamp}.json"`,
          "cache-control": "no-store",
        },
      });
    }

    throw new SessionError("Unknown export format.", 400);
  } catch (error) {
    return handleError(error);
  }
}
