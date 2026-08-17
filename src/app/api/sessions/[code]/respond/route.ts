import { handleError, json, participantAuth, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { SessionError, submitResponse, type ResponsePayload } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RespondBody extends ResponsePayload {
  questionId?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { participantId, secret } = participantAuth(req);
    if (!participantId || !secret) throw new SessionError("Rejoin to answer.", 401);

    // Per-participant, so one noisy device cannot spend the room's budget.
    const limit = rateLimit(`respond:${participantId}`, 40, 60_000);
    if (!limit.ok) {
      return json({ error: "You're going a bit fast — try again in a moment." }, { status: 429 });
    }
    const ipLimit = rateLimit(clientKey(req, "respond-ip"), 600, 60_000);
    if (!ipLimit.ok) return json({ error: "Too many requests." }, { status: 429 });

    const { code } = await ctx.params;
    const body = await readJson<RespondBody>(req);
    if (!body.questionId) throw new SessionError("Missing question.", 400);

    const state = await submitResponse(code, participantId, secret, body.questionId, {
      optionIds: body.optionIds,
      points: body.points,
      text: body.text,
    });

    return json({ state });
  } catch (error) {
    return handleError(error);
  }
}
